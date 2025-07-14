<?php

namespace AppBundle\Entity;

use AppBundle\Behavior\Entity\NormalizableInterface;
use AppBundle\Behavior\Entity\TimestampableInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

/**
 * Cube
 */
class Cube implements NormalizableInterface, TimestampableInterface
{
    /**
     * @var integer
     */
    private $id;

    /**
     * @var string|null
     */
    private $uuid;

    /**
     * @var string
     */
    private $name;

    /**
     * @var \DateTime
     */
    private $dateCreation;

    /**
     * @var \DateTime
     */
    private $dateUpdate;

    /**
     * @var string
     */
    private $description;

    /**
     * @var string
     */
    private $tags;

    /**
     * @var Collection|Cubeslot[]
     */
    private $slots;

    /**
     * @var User
     */
    private $user;

    /**
     * @var Pack
     */
    private $lastPack;

    /**
     * @var Collection
     */
    private $changes;

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->slots = new ArrayCollection();
    }

    /**
     * @return string
     */
    public function __toString()
    {
        return "[$this->id] $this->name";
    }

    /**
     * @return array
     */
    public function normalize()
    {
        $cards = [];
        foreach ($this->slots as $slot) {
            $cards[$slot->getCard()->getCode()] = $slot->getQuantity();
        }

        return [
            'id'            => $this->id,
            'uuid'          => $this->uuid,
            'date_creation' => $this->dateCreation->format('c'),
            'date_update'   => $this->dateUpdate->format('c'),
            'name'          => $this->name,
            'description'   => $this->description,
            'cards'         => $cards,
            'tags'          => $this->tags,
        ];
    }

    /**
     * @return int
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * @return null|string
     */
    public function getUuid()
    {
        return $this->uuid;
    }

    /**
     * @param string $uuid
     * @return $this
     */
    public function setUuid(string $uuid)
    {
        $this->uuid = $uuid;

        return $this;
    }

    /**
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * @param string $name
     * @return $this
     */
    public function setName(string $name)
    {
        $this->name = $name;

        return $this;
    }

    /**
     * @return \DateTime
     */
    public function getDateCreation()
    {
        return $this->dateCreation;
    }

    /**
     * @param \DateTime $dateCreation
     * @return $this
     */
    public function setDateCreation(\DateTime $dateCreation)
    {
        $this->dateCreation = $dateCreation;

        return $this;
    }

    /**
     * @return \DateTime
     */
    public function getDateUpdate()
    {
        return $this->dateUpdate;
    }

    /**
     * @param \DateTime $dateUpdate
     * @return $this
     */
    public function setDateUpdate(\DateTime $dateUpdate)
    {
        $this->dateUpdate = $dateUpdate;

        return $this;
    }

    /**
     * @return string
     */
    public function getDescription()
    {
        return $this->description;
    }

    /**
     * @param string $description
     * @return $this
     */
    public function setDescription(string $description)
    {
        $this->description = $description;

        return $this;
    }

    /**
     * @param Cubeslot $slots
     * @return $this
     */
    public function addSlot(Cubeslot $slots)
    {
        $this->slots[] = $slots;

        return $this;
    }

    /**
     * @param Cubeslot $slots
     */
    public function removeSlot(Cubeslot $slots)
    {
        $this->slots->removeElement($slots);
    }

    /**
     * @return Cubeslot[]|ArrayCollection|Collection
     */
    public function getSlots()
    {
        return $this->slots;
    }

    /**
     * @return User
     */
    public function getUser()
    {
        return $this->user;
    }

    /**
     * @param User $user
     * @return $this
     */
    public function setUser(User $user)
    {
        $this->user = $user;

        return $this;
    }

    /**
     * @return Pack
     */
    public function getLastPack()
    {
        return $this->lastPack;
    }

    /**
     * @param Pack $lastPack
     * @return $this
     */
    public function setLastPack(Pack $lastPack)
    {
        $this->lastPack = $lastPack;

        return $this;
    }

    /**
     * @return string
     */
    public function getTags()
    {
        return $this->tags;
    }

    /**
     * @param string $tags
     * @return $this
     */
    public function setTags(string $tags)
    {
        $this->tags = $tags;

        return $this;
    }

    /**
     * @return array
     */
    public function getCards()
    {
        $arr = [];
        foreach ($this->slots as $slot) {
            $card = $slot->getCard();
            $arr[$card->getCode()] = ['qty' => $slot->getQuantity(), 'card' => $card];
        }

        return $arr;
    }

    /**
     * @return array
     */
    public function getContent()
    {
        $arr = [];
        foreach ($this->slots as $slot) {
            $arr[$slot->getCard()->getCode()] = $slot->getQuantity();
        }
        ksort($arr);

        return $arr;
    }

    /**
     * @param Cubechange $changes
     * @return $this
     */
    public function addChange(Cubechange $changes)
    {
        $this->changes[] = $changes;

        return $this;
    }

    /**
     * @param Cubechange $changes
     */
    public function removeChange(Cubechange $changes)
    {
        $this->changes->removeElement($changes);
    }

    /**
     * @return Collection
     */
    public function getChanges()
    {
        return $this->changes;
    }
}
