import { expect, assert } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Console } from "console";
import { utils } from "mocha";


describe("Marketplace", function () {
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;
    let buyer2: SignerWithAddress;

    let uriNFT = "https://gateway.pinata.cloud/ipfs/QmWWXb1n1avqmxfQpS3htjgFi7rufJYBpHCTUE9UEbhq3f";
    let tokenIdNFT;
    let costNft = 100;
    let balanceAccount = 1000;
    let marketplace: any;
    let token: any;
    let nft: any;

    // создаём экземпляр контрактов
    beforeEach(async () => {
        [owner, seller, buyer, buyer2] = await ethers.getSigners();
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
        await token.connect(owner).transfer(buyer2.address, balanceAccount);
        // разрешаем контракту списывать токены
        await token.connect(seller).approve(marketplace.address, balanceAccount);
        await token.connect(buyer).approve(marketplace.address, balanceAccount);
        await token.connect(buyer2).approve(marketplace.address, balanceAccount);
        await token.connect(owner).approve(marketplace.address, balanceAccount);
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

    it('Checking function createItem()', async () => {
        expect(await nft.balanceOf(seller.address)).to.be.equal(1)
        // Убеждаемся что урл есть под id = 0
        expect(await nft.tokenURI(0)).to.have.string(uriNFT)
        // Убеждаемся что nft принадлежит овнеру
        expect(await nft.ownerOf(0)).to.be.equal(seller.address)
    });
    it('Checking function listItem()', async () => {
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
    it('Checking function buyItem()', async () => {
        let balanceBuyer1, balanceBuyer2, balanceMarketplace, balanceSeller;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceSeller = await token.balanceOf(seller.address);

        // Убеждаемся что нельзя купить несуществующий лот
        await expect(marketplace.connect(buyer).buyItem(0)).to.be.revertedWith(
            "NFT does not exist"
        );
        // выставляем NFT на продажу
        const Event = await marketplace.connect(seller).listItem(0, costNft);
        // Убеждаемся что владелец не может покупать
        await expect(marketplace.connect(seller).buyItem(0)).to.be.revertedWith(
            "Owner cant buy his nft"
        );

        // Покупаем
        await marketplace.connect(buyer).buyItem(0);

        // Проверяем балансы
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1.toNumber() - costNft)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(0)
        expect(await token.balanceOf(seller.address)).to.be.equal(balanceSeller.toNumber() + costNft)
        expect(await nft.ownerOf(0)).to.be.equal(buyer.address)    // NFT

        // Проверяем удаление данных о продавце
        expect((await marketplace.sListItem(0)).price).to.be.equal(0)
        expect((await marketplace.sListItem(0)).vendor).to.be.equal(ethers.constants.AddressZero)
    });
    it('Checking function cancel()', async () => {
        // выставляем NFT на продажу
        await marketplace.connect(seller).listItem(0, costNft);
        // Убеждаемся что "НЕ овнер" не сможет отменить продажу NFT
        await expect(marketplace.connect(buyer).cancel(0)).to.be.revertedWith(
            "Only owner can cancel sell"
        );
        const event = await marketplace.connect(seller).cancel(0);
        // Проверка эвента
        expect(event).to.emit(marketplace, "Cancel")
            .withArgs(seller.address, 0)

        // Проверка что НЕТ выставленного лота в мапинге
        expect((await marketplace.sListItem(0)).vendor).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListItem(0)).price).to.be.equal(0)
    });
    it('Checking function listItemOnAuction()', async () => {
        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);

        // Проверка выставленного лота в мапинге
        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(seller.address)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(costNft)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(0)
    });
    /*
    Проверка заключается в следующем:
    1 - Запоминаем балансы(ERC20) двух покупателей и контракта
    2 - Первый покупатель делает ставку
    3 - Проверяем балансы обоих пользователей, контракта и данные маппинга
    4 - Второй покупатель делает ставку
    5 - Проверяем балансы обоих пользователей, контракта и данные маппинга
    6 - Смещаем время на 3 дня
    7 - Проверяем что функция makeBid() уже недоступна
    */
    it('Checking function makeBid()', async () => {
        let balanceBuyer1, balanceBuyer2, balanceMarketplace;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceBuyer2 = await token.balanceOf(buyer2.address);
        balanceMarketplace = await token.balanceOf(marketplace.address);

        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);
        // делаем ставку по той же цене(проверка require)
        await expect(marketplace.connect(buyer).makeBid(0, costNft)).to.be.revertedWith(
            "Your price must be more than the minimum bid"
        );
        // Делаем ставку по цене + 1
        await marketplace.connect(buyer).makeBid(0, costNft * 2);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1 - costNft * 2)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(costNft * 2)

        // Проверка маппинга. Все ли корректно
        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(seller.address)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(costNft * 2)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(buyer.address)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(1)

        // Делаем ставку по цене + 1
        await marketplace.connect(buyer2).makeBid(0, costNft * 3);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1)
        expect(await token.balanceOf(buyer2.address)).to.be.equal(balanceBuyer2 - costNft * 3)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(costNft * 3)

        // Проверка маппинга. Все ли корректно
        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(seller.address)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(costNft * 3)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(buyer2.address)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(2)

        // Смещаем время на 3 дня
        const days = 60 * 60 * 24 * 3;
        await ethers.provider.send("evm_increaseTime", [days]);
        await ethers.provider.send("evm_mine", []);

        // Делаем ставку после 3х суток
        await expect(marketplace.connect(buyer).makeBid(0, costNft * 4)).to.be.revertedWith(
            "Auction ended"
        );
    });
    it('Checking function finishAuction() no bid', async () => {
        let balanceBuyer1, balanceMarketplace;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceMarketplace = await token.balanceOf(marketplace.address);
        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);

        // Пытаемся завершить аукцион
        await expect(marketplace.connect(buyer).finishAuction(0)).to.be.revertedWith(
            "Auction has not ended yet"
        );

        // Смещаем время на 3 дня
        const days = 60 * 60 * 24 * 3;
        await ethers.provider.send("evm_increaseTime", [days]);
        await ethers.provider.send("evm_mine", []);

        // Завершаем аукцион сторонним пользователем
        await marketplace.finishAuction(0);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(0)
        expect(await nft.ownerOf(0)).to.be.equal(seller.address)    // NFT

        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(0)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(0)
    });
    it('Checking function finishAuction() 1 bid', async () => {
        let balanceBuyer1, balanceMarketplace;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceMarketplace = await token.balanceOf(marketplace.address);

        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);

        // Делаем ставку по цене * 2
        await marketplace.connect(buyer).makeBid(0, costNft * 2);

        // Смещаем время на 3 дня
        const days = 60 * 60 * 24 * 3;
        await ethers.provider.send("evm_increaseTime", [days]);
        await ethers.provider.send("evm_mine", []);

        // Завершаем аукцион сторонним пользователем
        await marketplace.finishAuction(0);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(0)
        expect(await nft.ownerOf(0)).to.be.equal(seller.address)    // NFT

        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(0)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(0)

    });
    it('Checking function finishAuction() 3 bid', async () => {
        let balanceBuyer1, balanceBuyer2, balanceMarketplace, balanceSeller;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceBuyer2 = await token.balanceOf(buyer2.address);
        balanceMarketplace = await token.balanceOf(marketplace.address);
        balanceSeller = await token.balanceOf(seller.address);
        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);

        // Делаем ставку по цене * 2
        await marketplace.connect(buyer).makeBid(0, costNft + 1);
        await marketplace.connect(buyer2).makeBid(0, costNft + 2);
        await marketplace.connect(buyer).makeBid(0, costNft + 3);

        // Смещаем время на 3 дня
        const days = 60 * 60 * 24 * 3;
        await ethers.provider.send("evm_increaseTime", [days]);
        await ethers.provider.send("evm_mine", []);

        // Завершаем аукцион сторонним пользователем
        await marketplace.finishAuction(0);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1.toNumber() - costNft - 3)
        expect(await token.balanceOf(buyer2.address)).to.be.equal(balanceBuyer2)
        expect(await token.balanceOf(seller.address)).to.be.equal(balanceSeller.toNumber() + costNft + 3)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(0)
        expect(await nft.ownerOf(0)).to.be.equal(buyer.address)    // NFT

        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(0)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(0)

    });
    it('Checking function cancelAuction() has bid', async () => {
        let balanceBuyer1, balanceMarketplace;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceMarketplace = await token.balanceOf(marketplace.address);
        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);

        // Пытаемся завершить аукцион
        await expect(marketplace.connect(seller).cancelAuction(0)).to.be.revertedWith(
            "Auction has not ended yet"
        );
        // Делаем ставку по цене * 2
        await marketplace.connect(buyer).makeBid(0, costNft + 1);

        // Смещаем время на 3 дня
        const days = 60 * 60 * 24 * 3;
        await ethers.provider.send("evm_increaseTime", [days]);
        await ethers.provider.send("evm_mine", []);

        // Пытаемся завершить аукцион
        await expect(marketplace.connect(buyer).cancelAuction(0)).to.be.revertedWith(
            "Only owner can cancel auction"
        );

        // Завершаем аукцион сторонним пользователем
        await marketplace.connect(seller).cancelAuction(0);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(0)
        expect(await nft.ownerOf(0)).to.be.equal(seller.address)    // NFT

        expect((await marketplace.sListAuction(0)).vendor).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).bidPrice).to.be.equal(0)
        expect((await marketplace.sListAuction(0)).lastBuyer).to.be.equal(ethers.constants.AddressZero)
        expect((await marketplace.sListAuction(0)).numBid).to.be.equal(0)
    });
    it('Checking function cancelAuction() has not bid', async () => {
        let balanceBuyer1, balanceMarketplace;

        balanceBuyer1 = await token.balanceOf(buyer.address);
        balanceMarketplace = await token.balanceOf(marketplace.address);
        // выставляем NFT на продажу
        const event = await marketplace.connect(seller).listItemOnAuction(0, costNft);

        // Смещаем время на 3 дня
        const days = 60 * 60 * 24 * 3;
        await ethers.provider.send("evm_increaseTime", [days]);
        await ethers.provider.send("evm_mine", []);

        // Завершаем аукцион сторонним пользователем
        await marketplace.connect(seller).cancelAuction(0);

        // проверяем балансы аккаунтов
        expect(await token.balanceOf(buyer.address)).to.be.equal(balanceBuyer1)
        expect(await token.balanceOf(marketplace.address)).to.be.equal(0)
        expect(await nft.ownerOf(0)).to.be.equal(seller.address)    // NFT
    });
});