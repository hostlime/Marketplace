import { expect, assert } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


describe("Marketplace", function () {
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addrs: SignerWithAddress[];

    let marketplace: any;
    let token: any;
    let nft: any;

    // создаём экземпляр контрактов
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        // NFT
        const Nft = await ethers.getContractFactory("TokenERC721");
        nft = await Nft.deploy();
        await nft.deployed();
        // Токен для рассчета
        const Token = await ethers.getContractFactory("MyERC20");
        token = await Token.deploy();
        await token.deployed();
        // Контракт МАРКЕТПЛЕЙСА
        const Marketplace = await ethers.getContractFactory("Marketplace");
        marketplace = await Marketplace.deploy(nft.address, token.address);
        await marketplace.deployed();

    });
    // проверка, что контракт NFT задеплоен
    it('Checking that contract NFT is deployed', () => {
        assert(nft.address);
    });
    // проверка, что контракт Token задеплоен
    it('Checking that contract Token ERC20 is deployed', () => {
        assert(token.address);
    });
    // проверка, что контракт Marketplace задеплоен
    it('Checking that contract Marketplace is deployed', () => {
        assert(marketplace.address);
    });




});