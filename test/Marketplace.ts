import { expect, assert } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


describe("Marketplace", function () {
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addrs: SignerWithAddress[];

    let uriNFT = "https://gateway.pinata.cloud/ipfs/QmWWXb1n1avqmxfQpS3htjgFi7rufJYBpHCTUE9UEbhq3f";

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
        await nft.deployed();

        // Назначаем роль минтера nft для контракта маркетплейса
        const MARKET_ROLE = await nft.MARKET_ROLE();
        await nft.grantRole(MARKET_ROLE, marketplace.address);

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

    // проверка, что у marketplace есть роль MARKET_ROLE и контракт может минтить NFT
    it('Checking that marketplace has role a MARKET_ROLE', async () => {
        const MARKET_ROLE = await nft.MARKET_ROLE();
        const result = await nft.hasRole(MARKET_ROLE, marketplace.address);
        expect(result).to.be.equal(true);
    });

    it.only('Checking function createItem()', async () => {
        const _tokenID = await marketplace.createItem(uriNFT);
        expect(await nft.balanceOf(owner.address)).to.be.equal(1)
        // Убеждаемся что урл есть под id = 0
        expect(await nft.tokenURI(0)).to.have.string(uriNFT)
        // Убеждаемся что nft принадлежит овнеру
        expect(await nft.ownerOf(0)).to.be.equal(owner.address)
    });


});