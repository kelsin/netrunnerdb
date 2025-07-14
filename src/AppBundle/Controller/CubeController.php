<?php

namespace AppBundle\Controller;

use AppBundle\Entity\Card;
use AppBundle\Entity\Cube;
use AppBundle\Entity\Cubechange;
use AppBundle\Entity\Cubeslot;
use AppBundle\Entity\User;
use AppBundle\Service\CardsData;
use AppBundle\Service\CubeManager;
use AppBundle\Service\Judge;
use AppBundle\Service\TextProcessor;
use Doctrine\ORM\EntityManagerInterface;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class CubeController extends Controller
{
    /**
     * @param string                 $card_code
     * @param EntityManagerInterface $entityManager
     * @return Response
     *
     * @IsGranted("IS_AUTHENTICATED_REMEMBERED")
     */
    public function newAction(EntityManagerInterface $entityManager)
    {
        $response = new Response();
        $response->setPublic();
        $response->setMaxAge($this->getParameter('long_cache'));

        return $this->render(
            '/Cube/cube.html.twig',
            [
                'pagetitle'           => "Cubebuilder",
                'pagedescription'     => "Build your own custom cube with the help of a powerful cubebuilder.",
                'cube'                => [
                    "slots"       => [],
                    "name"        => "New Cube",
                    "description" => "",
                    "id"          => "",
                    "uuid"        => "",
                    "tags"        => "",
                    "history"     => [],
                    "unsaved"     => 0,
                ],
            ],
            $response
        );
    }

    /**
     * @param EntityManagerInterface $entityManager
     * @param CubeManager            $cubeManager
     * @return Response
     * @throws \Doctrine\DBAL\DBALException
     *
     * @IsGranted("IS_AUTHENTICATED_REMEMBERED")
     */
    public function listAction(EntityManagerInterface $entityManager, CubeManager $cubeManager)
    {
        $user = $this->getUser();

        $cubes = $cubeManager->getByUser($user, false);

        return $this->render(

            '/Cube/cubes.html.twig',
            [
                'pagetitle'       => "My Cubes",
                'pagedescription' => "Create custom cubes.",
                'cubes'           => $cubes,
                'nbmax'           => $user->getMaxNbCubes(),
                'nbcubes'         => count($cubes),
                'cannotcreate'    => $user->getMaxNbCubes() <= count($cubes),
            ]
        );
    }

    /**
     * @param string                 $cube_uuid
     * @param EntityManagerInterface $entityManager
     * @return Response
     * @throws \Doctrine\DBAL\DBALException
     */
    public function viewAction(string $cube_uuid, EntityManagerInterface $entityManager) {
        $dbh = $entityManager->getConnection();
        $rows = $dbh->executeQuery("
            SELECT
              c.id,
              c.uuid,
              c.name,
              c.description,
              c.date_update,
              u.username user_name,
              CASE WHEN u.id=? THEN 1 ELSE 0 END is_owner
            FROM `cube` c
            LEFT JOIN user u ON c.user_id=u.id
            WHERE (u.id=? OR u.share_decks=1) AND c.uuid = ?",
            [
                $this->getUser() ? $this->getUser()->getId() : null,
                $this->getUser() ? $this->getUser()->getId() : null,
                $cube_uuid,
            ]
        )->fetchAll();

        if (!count($rows)) {
            throw $this->createNotFoundException();
        }

        $cube = $rows[0];

        $rows = $dbh->executeQuery("
            SELECT
              c.code,
              s.quantity
            FROM cubeslot s
              JOIN card c ON s.card_id=c.id
            WHERE s.cube_id=?", [
            $cube['id'],
        ])->fetchAll();

        $cards = [];
        foreach ($rows as $row) {
            $cards[$row['code']] = $row['quantity'];
        }
        $cube['slots'] = $cards;

        $description = "An unpublished cube by " . $cube["user_name"] . ".";

        return $this->render(
            '/Cube/cubeview.html.twig',
            [
                'pagetitle'           => "Cubebuilder",
                'pagedescription'     => $description,
                'cube'                => $cube,
            ]
        );
    }

    /**
     * @param string                    $cube_uuid
     * @param EntityManagerInterface    $entityManager
     * @return Response
     * @throws \Doctrine\DBAL\DBALException
     *
     * @IsGranted("IS_AUTHENTICATED_REMEMBERED")
     */
    public function editAction(string $cube_uuid, EntityManagerInterface $entityManager)
    {
        $dbh = $entityManager->getConnection();
        $rows = $dbh->executeQuery("
            SELECT
              c.id,
              c.uuid,
              c.name,
              DATE_FORMAT(c.date_creation, '%Y-%m-%dT%TZ') date_creation,
              DATE_FORMAT(c.date_update, '%Y-%m-%dT%TZ') date_update,
              c.description,
              c.tags,
              u.id user_id,
              (SELECT count(*) FROM cubechange cc WHERE cc.cube_id=c.id AND cc.saved=0) unsaved
            FROM `cube` c
            LEFT JOIN user u ON c.user_id=u.id
            WHERE
              c.uuid = ?", [$cube_uuid])->fetchAll();
        $cube = $rows[0];

        if ($this->getUser()->getId() != $cube['user_id']) {
            throw $this->createAccessDeniedException();
        }

        $rows = $dbh->executeQuery("
            SELECT
              c.code,
              s.quantity
            FROM cubeslot s
              JOIN card c ON s.card_id=c.id
            WHERE s.cube_id=?", [
            $cube['id'],
        ])->fetchAll();

        $cards = [];
        foreach ($rows as $row) {
            $cards[$row['code']] = intval($row['quantity']);
        }

        $snapshots = [];

        $rows = $dbh->executeQuery("
            SELECT
              DATE_FORMAT(c.date_creation, '%Y-%m-%dT%TZ') date_creation,
              c.variation,
              c.saved
            FROM cubechange c
            WHERE c.cube_id=? AND c.saved=1
            ORDER BY date_creation DESC", [$cube['id']])->fetchAll();

        // recreating the versions with the variation info, starting from $preversion
        $preversion = $cards;
        foreach ($rows as $row) {
            $row['variation'] = $variation = json_decode($row['variation'], true);
            $row['saved'] = (boolean) $row['saved'];
            // add preversion with variation that lead to it
            $row['content'] = $preversion;
            array_unshift($snapshots, $row);

            // applying variation to create 'next' (older) preversion
            foreach ($variation[0] as $code => $qty) {
                $preversion[$code] = $preversion[$code] - $qty;
                if ($preversion[$code] == 0) {
                    unset($preversion[$code]);
                }
            }
            foreach ($variation[1] as $code => $qty) {
                if (!isset($preversion[$code])) {
                    $preversion[$code] = 0;
                }
                $preversion[$code] = $preversion[$code] + $qty;
            }
            ksort($preversion);
        }

        // add last know version with empty diff
        $row['content'] = $preversion;
        $row['date_creation'] = $cube['date_creation'];
        $row['saved'] = true;
        $row['variation'] = null;
        array_unshift($snapshots, $row);

        $rows = $dbh->executeQuery("
            SELECT
              DATE_FORMAT(c.date_creation, '%Y-%m-%dT%TZ') date_creation,
              c.variation,
              c.saved
            FROM cubechange c
            WHERE c.cube_id=? AND c.saved=0
            ORDER BY date_creation ASC", [$cube['id']])->fetchAll();

        // recreating the snapshots with the variation info, starting from $postversion
        $postversion = $cards;
        foreach ($rows as $row) {
            $row['variation'] = $variation = json_decode($row['variation'], true);
            $row['saved'] = (boolean) $row['saved'];
            // applying variation to postversion
            foreach ($variation[0] as $code => $qty) {
                if (!isset($postversion[$code])) {
                    $postversion[$code] = 0;
                }
                $postversion[$code] = $postversion[$code] + $qty;
            }
            foreach ($variation[1] as $code => $qty) {
                $postversion[$code] = $postversion[$code] - $qty;
                if ($postversion[$code] == 0) {
                    unset($postversion[$code]);
                }
            }
            ksort($postversion);

            // add postversion with variation that lead to it
            $row['content'] = $postversion;
            array_push($snapshots, $row);
        }

        // current cube is newest snapshot
        $cube['slots'] = $postversion;

        $cube['history'] = $snapshots;

        return $this->render(
            '/Cube/cube.html.twig',
            [
                'pagetitle'           => "Cubebuilder",
                'pagedescription'     => "Build your own custom cube with the help of a powerful cubebuilder.",
                'cube'                => $cube,
            ]
        );
    }

    /**
     * @param Request                $request
     * @param EntityManagerInterface $entityManager
     * @param CubeManager            $cubeManager
     * @param TextProcessor          $textProcessor
     * @return \Symfony\Component\HttpFoundation\RedirectResponse|Response
     *
     * @IsGranted("IS_AUTHENTICATED_REMEMBERED")
     */
    public function saveAction(Request $request, EntityManagerInterface $entityManager, CubeManager $cubeManager, TextProcessor $textProcessor)
    {
        /** @var User $user */
        $user = $this->getUser();
        if ($user->getCubes()->count() > $user->getMaxNbCubes()) {
            return new Response('You have reached the maximum number of cubes allowed. Delete some cubes or increase your reputation.');
        }

        $id = filter_var($request->get('id'), FILTER_SANITIZE_NUMBER_INT);
        $cube = null;
        $source_cube = null;
        if ($id) {
            $cube = $entityManager->getRepository('AppBundle:Cube')->find($id);
            if (!$cube instanceof Cube || $user->getId() != $cube->getUser()->getId()) {
                throw $this->createAccessDeniedException();
            }
            $source_cube = $cube;
        }

        $cancel_edits = (boolean) filter_var($request->get('cancel_edits'), FILTER_SANITIZE_NUMBER_INT);
        if ($cancel_edits) {
            if ($cube) {
                $cubeManager->revertCube($cube);
            }

            return $this->redirect($this->generateUrl('cubes_list'));
        }

        $is_copy = (boolean) filter_var($request->get('copy'), FILTER_SANITIZE_NUMBER_INT);
        if ($is_copy || !$id) {
            $cube = new Cube();
            $entityManager->persist($cube);
        }

        $content = (array) json_decode($request->get('content'));
        if (!count($content)) {
            return new Response('Cannot import empty cube');
        }
        $name = filter_var($request->get('name'), FILTER_SANITIZE_STRING, FILTER_FLAG_NO_ENCODE_QUOTES);
        $description = $textProcessor->purify(trim($request->get('description')));
        $tags = explode(',', filter_var($request->get('tags'), FILTER_SANITIZE_STRING, FILTER_FLAG_NO_ENCODE_QUOTES));

        if ($cube instanceof Cube) {
            $cubeManager->saveCube($this->getUser(), $cube, $name, $description, $tags, $content, $source_cube ? $source_cube : null);
        }

        return $this->redirect($this->generateUrl('cubes_list'));
    }

    /**
     * @param Request                $request
     * @param EntityManagerInterface $entityManager
     * @return \Symfony\Component\HttpFoundation\RedirectResponse
     *
     * @IsGranted("IS_AUTHENTICATED_REMEMBERED")
     */
    public function deleteAction(Request $request, EntityManagerInterface $entityManager)
    {
        $cube_uuid = $request->get('cube_uuid');
        $cube = $entityManager->getRepository('AppBundle:Cube')->findOneBy(['uuid' => $request->get('cube_uuid')]);
        if (!$cube instanceof Cube) {
            return $this->redirect($this->generateUrl('cubes_list'));
        }
        if ($this->getUser()->getId() != $cube->getUser()->getId()) {
            throw $this->createAccessDeniedException();
        }

        $entityManager->remove($cube);
        $entityManager->flush();

        $this->addFlash('notice', "Cube deleted.");

        return $this->redirect($this->generateUrl('cubes_list'));
    }

    /**
     * @param Cube $cube
     * @param Judge $judge
     * @param CardsData $cardsData
     * @return Response
     *
     * @IsGranted("IS_AUTHENTICATED_REMEMBERED")
     *
     * @ParamConverter("cube", class="AppBundle:Cube", options={"mapping": {"cube_uuid": "uuid"}})
     */
    public function textExportAction(Cube $cube, Judge $judge, CardsData $cardsData)
    {
        if ($this->getUser()->getId() != $cube->getUser()->getId()) {
            throw $this->createAccessDeniedException();
        }

        $response = new Response();

        $name = mb_strtolower($cube->getName());
        $name = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $name);
        $name = preg_replace('/--+/', '-', $name);

        $lines = [$name];
        $types = [
            "Runner Identity",
            "Event",
            "Hardware",
            "Resource",
            "Icebreaker",
            "Program",
            "Corp Identity",
            "Agenda",
            "Asset",
            "Upgrade",
            "Operation",
            "Barrier",
            "Code Gate",
            "Sentry",
            "Ice",
        ];

        $classement = $judge->cube_classify($cube->getSlots()->toArray());

        foreach ($types as $type) {
            if (isset($classement[$type]) && $classement[$type]['qty']) {
                $lines[] = "";
                $lines[] = $type . " (" . $classement[$type]['qty'] . ")";
                foreach ($classement[$type]['slots'] as $slot) {
                    $inf = "";

                    /** @var Card $card */
                    $card = $slot['card'];

                    $lines[] = sprintf(
                        '%sx %s (%s) %s',
                        $slot['qty'],
                        $card->getTitle(),
                        $card->getPack()->getName(),
                        trim($inf)
                    );
                }
            }
        }

        $lines[] = "";

        $lines[] = "Cards up to " . $cube->getLastPack()->getName();
        $content = implode("\r\n", $lines);

        $response->headers->set('Content-Type', 'text/plain');
        $response->headers->set('Content-Disposition', 'attachment;filename=' . $name . ".txt");

        $response->setContent($content);

        return $response;
    }
}
