<?php

namespace AppBundle\Entity;

/**
 * Cubechange
 */
class Cubechange
{
    /**
     * @var integer
     */
    private $id;

    /**
     * @var \DateTime
     */
    private $dateCreation;

    /**
     * @var string
     */
    private $variation;

    /**
     * @var Cube
     */
    private $cube;

    /**
     * @var boolean
     */
    private $saved;

    /**
     * @return int
     */
    public function getId()
    {
        return $this->id;
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
    public function setDatecreation(\DateTime $dateCreation)
    {
        $this->dateCreation = $dateCreation;

        return $this;
    }

    /**
     * @return string
     */
    public function getVariation()
    {
        return $this->variation;
    }

    /**
     * @param string $variation
     * @return $this
     */
    public function setVariation(string $variation)
    {
        $this->variation = $variation;

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
     * @return boolean
     */
    public function getSaved()
    {
        return $this->saved;
    }

    /**
     * @param boolean $saved
     * @return Cubechange
     */
    public function setSaved(bool $saved)
    {
        $this->saved = $saved;

        return $this;
    }
}
