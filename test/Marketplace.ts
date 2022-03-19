import { expect, assert } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Console } from "console";


describe("Marketplace", function () {
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;
    let addrs: SignerWithAddress[];

    let uriNFT = "https://gateway.pinata.cloud/ipfs/QmWWXb1n1avqmxfQpS3htjgFi7rufJYBpHCTUE9UEbhq3f";
    let tokenIdNFT;
    let costNft = 100;
    let balanceAccount = 1000;
    let marketplace: any;
    let token: any;
    let nft: any;

    // создаём экземпляр контрактов
    beforeEach(async () => {
        [owner, seller, buyer, ...addrs] = await ethers.getSigners();
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

        // Назначаем роль минтера nft для контракта маркетплейса
        const MARKET_ROLE = await nft.MARKET_ROLE();
        await nft.grantRole(MARKET_ROLE, marketplace.address);

        // Минтим NFT
        tokenIdNFT = (await marketplace.connect(seller).createItem(uriNFT)).value.toNumber();
        // Апрувим NFT для контракта
        await nft.connect(seller).approve(marketplace.address, tokenIdNFT);

        // Даем токены erc20 покупателю и продавцу
        await token.connect(owner).transfer(seller.address, balanceAccount);
        await token.connect(owner).transfer(buyer.address, balanceAccount);
        // разрешаем контракту списывать токены
        await token.connect(seller).approve(marketplace.address, balanceAccount);
        await token.connect(buyer).approve(marketplace.address, balanceAccount);
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
        expect(await nft.balanceOf(seller.address)).to.be.equal(1)
        // Убеждаемся что урл есть под id = 0
        expect(await nft.tokenURI(0)).to.have.string(uriNFT)
        // Убеждаемся что nft принадлежит овнеру
        expect(await nft.ownerOf(0)).to.be.equal(seller.address)
    });
    it.only('Checking function listItem()', async () => {
        // Убеждаемся что только владелец может выставить на аукцион 
        await expect(marketplace.connect(buyer).listItem(0, costNft)).to.be.revertedWith(
            "Only owner NFT can call this function widt that _tokenID"
        );
        const Event = await marketplace.connect(seller).listItem(0, costNft);
        // Проверка эвента
        expect(Event).to.emit(marketplace, "ListItem")
            .withArgs(seller.address, 0, costNft)
        // Проверка выставленного лота в мапинге
        expect((await marketplace.sListItem(0)).vendor).to.be.equal(seller.address)
        expect((await marketplace.sListItem(0)).price).to.be.equal(costNft)
    });
    it.only('Checking function buyItem()', async () => {
        // Убеждаемся что нельзя купить несуществующий лот
        await expect(marketplace.connect(buyer).buyItem(0)).to.be.revertedWith(
            "NFT does not exist"
        );
        // выставляем NFT на продажу
        await marketplace.connect(seller).listItem(0, costNft);
        // Убеждаемся что владелец не может покупать
        await expect(marketplace.connect(seller).buyItem(0)).to.be.revertedWith(
            "Owner cant buy his nft"
        );


    });

});