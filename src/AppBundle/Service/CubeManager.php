<?php

namespace AppBundle\Service;

use AppBundle\Entity\Card;
use AppBundle\Entity\Cube;
use AppBundle\Entity\Cubechange;
use AppBundle\Entity\Cubeslot;
use AppBundle\Entity\Pack;
use AppBundle\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Psr\Log\LoggerInterface;
use Ramsey\Uuid\Uuid;

class CubeManager
{
    /** @var EntityManagerInterface $entityManager */
    private $entityManager;

    /** @var DiffService $diff */
    private $diff;

    /** @var LoggerInterface $logger */
    private $logger;

    public function __construct(EntityManagerInterface $entityManager, DiffService $diff, LoggerInterface $logger)
    {
        $this->entityManager = $entityManager;
        $this->diff = $diff;
        $this->logger = $logger;
    }


    public function getByUser(User $user, bool $decode_variation = false)
    {
        $dbh = $this->entityManager->getConnection();
        $cubes = $dbh->executeQuery("
            SELECT
              c.id,
              c.uuid,
              c.name,
              DATE_FORMAT(c.date_creation, '%Y-%m-%dT%TZ') date_creation,
              DATE_FORMAT(c.date_update, '%Y-%m-%dT%TZ') date_update,
              c.description,
              c.tags,
              (SELECT count(*) FROM cubechange cc WHERE cc.cube_id=c.id AND cc.saved=0) unsaved,
              LPAD(y.position * 10 + p.position, 6, '0') lastpack_global_position,
              p.cycle_id cycle_id,
              p.position pack_number
            FROM `cube` c
              LEFT JOIN pack p ON c.last_pack_id=p.id
              LEFT JOIN cycle y ON p.cycle_id=y.id
            WHERE c.user_id=?
            ORDER BY date_update DESC",
            [
                $user->getId(),
            ]
        )
                     ->fetchAll();

        foreach ($cubes as $i => $cube) {
            $cubes[$i]['id'] = intval($cube['id']);
        }

        // slots

        $rows = $dbh->executeQuery("
            SELECT
              s.cube_id,
              a.code card_code,
              s.quantity qty
            FROM cubeslot s
              JOIN card a ON s.card_id=a.id
              JOIN `cube` c ON s.cube_id=c.id
            WHERE c.user_id=?",

            [
                $user->getId(),
            ]

        )
                    ->fetchAll();

        $cards = [];
        foreach ($rows as $row) {
            $cube_id = intval($row['cube_id']);
            unset($row['cube_id']);
            $row['qty'] = intval($row['qty']);
            if (!isset($cards[$cube_id])) {
                $cards[$cube_id] = [];
            }
            $cards[$cube_id][] = $row;
        }

        // changes

        $rows = $dbh->executeQuery("
            SELECT
              DATE_FORMAT(cc.date_creation, '%Y-%m-%dT%TZ') date_creation,
              cc.variation,
              cc.cube_id
            FROM cubechange cc
            JOIN `cube` c ON cc.cube_id=c.id
            WHERE c.user_id=? AND cc.saved=1",

            [
                $user->getId(),
            ]

        )
                    ->fetchAll();

        $changes = [];
        foreach ($rows as $row) {
            $cube_id = intval($row['cube_id']);
            unset($row['cube_id']);
            if ($decode_variation) {
                $row['variation'] = json_decode($row['variation'], true);
            }
            if (!isset($changes[$cube_id])) {
                $changes[$cube_id] = [];
            }
            $changes[$cube_id][] = $row;
        }

        foreach ($cubes as $i => $cube) {
            $cubes[$i]['cards'] = $cards[$cube['id']];
            $cubes[$i]['history'] = isset($changes[$cube['id']]) ? $changes[$cube['id']] : [];
            $cubes[$i]['unsaved'] = intval($cubes[$i]['unsaved']);
            $cubes[$i]['tags'] = $cube['tags'] ? explode(' ', $cube['tags']) : [];

            $problem_message = '';
            if ($cubes[$i]['unsaved'] > 0) {
                $problem_message = "This cube has unsaved changes.";
            }

            $cubes[$i]['message'] = $problem_message;
        }

        return $cubes;
    }

    public function getById(int $cube_id, bool $decode_variation = false)
    {
        $dbh = $this->entityManager->getConnection();
        $cube = $dbh->executeQuery("
            SELECT
              c.id,
              c.name,
              DATE_FORMAT(c.date_creation, '%Y-%m-%dT%TZ') date_creation,
              DATE_FORMAT(c.date_update, '%Y-%m-%dT%TZ') date_update,
              c.description,
              c.tags,
              (SELECT count(*) FROM cubechange cc WHERE cc.deck_id=c.id AND cc.saved=0) unsaved,
              a.title identity_title,
              a.code identity_code
            FROM `cube` c
              LEFT JOIN card a ON c.identity_id=a.id
            WHERE c.id=?",
            [
                $cube_id,
            ]
        )
                    ->fetch();

        $cube['id'] = intval($cube['id']);

        $rows = $dbh->executeQuery("
            SELECT
              a.code card_code,
              s.quantity qty
            FROM cubeslot s
              JOIN card a ON s.card_id=a.id
              JOIN deck c ON s.deck_id=c.id
            WHERE c.id=?",

            [
                $cube_id,
            ]

        )
                    ->fetchAll();

        $cards = [];
        foreach ($rows as $row) {
            $row['qty'] = intval($row['qty']);
            $cards[] = $row;
        }
        $cube['cards'] = $cards;

        $rows = $dbh->executeQuery("
            SELECT
              DATE_FORMAT(c.date_creation, '%Y-%m-%dT%TZ') date_creation,
              c.variation
            FROM cubechange c
            WHERE c.cube_id=? AND c.saved=1
            ORDER BY date_creation DESC",

            [
                $cube_id,
            ]

        )
                    ->fetchAll();

        $changes = [];
        foreach ($rows as $row) {
            if ($decode_variation) {
                $row['variation'] = json_decode($row['variation'], true);
            }
            $changes[] = $row;
        }
        $cube['history'] = $changes;

        $cube['tags'] = $cube['tags'] ? explode(' ', $cube['tags']) : [];

        return $cube;
    }

    /**
     * @param User        $user
     * @param Cube        $cube
     * @param string      $name
     * @param string      $description
     * @param array       $tags
     * @param array       $content
     * @param Cube|null   $source_cube
     * @return int
     */
    public function saveCube(
        User $user,
        Cube $cube,
        string $name,
        string $description,
        array $tags = [],
        array $content,
        Cube $source_cube = null
    ) {
        $cube_content = [];

        // Note: We are doing the naive thing and just assuming we won't collide.
        // If there is a collision, there will be an error returned to the user.
        // Sorry, users!  v2 will be nicer to you!
        if ($cube->getUuid() == null) {
          $cube->setUuid(Uuid::uuid4()->toString());
        }
        $cube->setName($name);
        $cube->setDescription($description);
        $cube->setUser($user);
        $cards = [];
        $latestPack = null;
        foreach ($content as $card_code => $qty) {
            /** @var Card $card */
            $card = $this->entityManager->getRepository('AppBundle:Card')->findOneBy([
                "code" => $card_code,
            ]);
            if (!$card) {
                continue;
            }
            $pack = $card->getPack();
            if (!$latestPack instanceof Pack) {
                $latestPack = $pack;
            } elseif ($latestPack->getCycle()->getPosition() < $pack->getCycle()->getPosition()) {
                $latestPack = $pack;
            } elseif ($latestPack->getCycle()->getPosition() == $pack->getCycle()->getPosition() && $latestPack->getPosition() < $pack->getPosition()) {
                $latestPack = $pack;
            }
            $cards[$card_code] = $card;
        }
        if ($latestPack instanceof Pack) {
            $cube->setLastPack($latestPack);
        }
        $cube->setTags(implode(' ', $tags));
        $this->entityManager->persist($cube);

        // on the cube content
        if ($source_cube) {
            // compute diff between current content and saved content
            list($listings) = $this->diff->diffContents([$content, $source_cube->getContent()]);
            // remove all change (autosave) since last cube update (changes are sorted)
            $changes = $this->getUnsavedChanges($cube);
            foreach ($changes as $change) {
                $this->entityManager->remove($change);
            }
            // save new change unless empty
            if (count($listings[0]) || count($listings[1])) {
                $change = new Cubechange();
                $change->setCube($cube);
                $change->setVariation(json_encode($listings));
                $change->setSaved(true);
                $this->entityManager->persist($change);
            }
        }
        foreach ($cube->getSlots() as $slot) {
            $cube->removeSlot($slot);
            $this->entityManager->remove($slot);
        }

        foreach ($content as $card_code => $qty) {
            $card = $cards[$card_code];
            $slot = new Cubeslot();
            $slot->setQuantity($qty);
            $slot->setCard($card);
            $slot->setCube($cube);
            $cube->addSlot($slot);
            $cube_content[$card_code] = [
                'card' => $card,
                'qty'  => $qty,
            ];
        }
        $cube->setDateUpdate(new \DateTime());
        $this->entityManager->flush();

        return $cube->getId();
    }

    public function revertCube(Cube $cube)
    {
        $changes = $this->getUnsavedChanges($cube);
        foreach ($changes as $change) {
            $this->entityManager->remove($change);
        }
        $this->entityManager->flush();
    }

    public function getUnsavedChanges(Cube $cube)
    {
        return $this->entityManager->getRepository('AppBundle:Cubechange')->findBy(['cube' => $cube, 'saved' => false]);
    }
}
