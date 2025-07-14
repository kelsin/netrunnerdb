<?php

namespace AppBundle\Entity;

use AppBundle\Behavior\Entity\SlotInterface;

/**
 * Cubeslot
 */
class Cubeslot implements SlotInterface
{
    /**
     * @var integer
     */
    private $id;

    /**
     * @var integer
     */
    private $quantity;

    /**
     * @var Cube
     */
    private $cube;

    /**
     * @var Card
     */
    private $card;

    /**
     * @return integer
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * @return integer
     */
    public function getQuantity()
    {
        return $this->quantity;
    }

    /**
     * @param integer $quantity
     * @return Cubeslot
     */
    public function setQuantity(int $quantity)
    {
        $this->quantity = $quantity;

        return $this;
    }

    /**
     * @return Cube
     */
    public function getCube()
    {
        return $this->cube;
    }

    /**
     * @param Cube $cube
     * @return $this
     */
    public function setCube(Cube $cube)
    {
        $this->cube = $cube;

        return $this;
    }

    /**
     * @return Card
     */
    public function getCard()
    {
        return $this->card;
    }

    /**
     * @param Card $card
     * @return $this
     */
    public function setCard(Card $card)
    {
        $this->card = $card;

        return $this;
    }
}
