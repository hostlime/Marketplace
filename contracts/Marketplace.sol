// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./NFT.sol"; // для функции mint и transferFrom

contract Marketplace {
    // В наличии статуса нет необходимости!!!  При продаже NFT будем затирать адрес продавца "vendor".
    // Это нас избавляет от лишних проверок и избыточных данных в storage
    enum _eStatus {
        Sale, // Продается
        Auction, // Аукцион
        Sold // Продажа завершена
    }

    struct _sListItem {
        address vendor; // Продавец
        uint256 price; // Стоимость nft
        //_eStatus eStatus;         // Статус продажи nft
    }
    // аукцион
    struct _sAuction {
        address vendor; // Продавец
        uint256 auctionStartTime; // время старта
        uint256 bidPrice; // Цена последней ставки (Можно сэкономить и использовать _sListItem.price)
        address lastBuyer; // Последний покупатель
        uint256 numBid; // Количество ставок
    }

    // Id(_tokenURI) NFT созданной с помощью функции createItem()
    mapping(uint256 => _sListItem) public sListItem; // Список NFT выставленных на продажу
    mapping(uint256 => _sAuction) public sListAuction; // Список аукционов

    uint256 private durationAuction = 3 days; // Длительность аукциона
    uint256 private countBidsForComplete = 2; // Минимальное количество ставок для пкупки на аукционе

    // Указатели на контракт продаваемых NFT и контракт токенов за которые производится продажа
    TokenERC721 private _NFT;
    IERC20 private _Token;

    constructor(TokenERC721 _NFT_, IERC20 _Token_) {
        _NFT = _NFT_;
        _Token = _Token_;
    }

    // Аукцион еще не закончился ?
    modifier auctionTimeEnded(uint256 _tokenID) {
        require(
            sListAuction[_tokenID].auctionStartTime + durationAuction <=
                block.timestamp,
            "Auction has not ended yet"
        );
        _;
    }
    // Только владелец NFT
    modifier onlyOwnerNFT(uint256 _tokenID) {
        require(
            _NFT.ownerOf(_tokenID) == msg.sender,
            "Only owner NFT can call this function widt that _tokenID"
        );
        _;
    }

    // Функция createItem() - создание нового предмета, обращается к контракту NFT и вызывает функцию mint.
    function createItem(string memory _tokenURI)
        public
        returns (uint256 _tokenID)
    {
        _tokenID = _NFT.mint(msg.sender, _tokenURI);
        emit CreateItem(msg.sender, _tokenID, _tokenURI);
    }

    // Функция listItem() - выставка на продажу предмета.
    function listItem(uint256 _tokenID, uint256 _price)
        public
        onlyOwnerNFT(_tokenID)
    {
        require(
            _NFT.ownerOf(_tokenID) == msg.sender,
            "Only owner can sell token"
        );
        // отправляем nft на контракт
        _NFT.transferFrom(msg.sender, address(this), _tokenID);

        // Сохраняем иформацию о выставлении предмета на продажу
        sListItem[_tokenID] = _sListItem({vendor: msg.sender, price: _price});
        emit ListItem(msg.sender, _tokenID, _price);
    }

    // Функция buyItem() - покупка предмета.
    function buyItem(uint256 _tokenID) public {
        _sListItem storage _ListItem = sListItem[_tokenID];
        // Убеждаемся что адрес продавца не равен 0, в противном случае такого лота не существует
        require(_ListItem.vendor != address(0x0), "NFT does not exist");
        // Овнер не может покупать свои лоты
        require(_ListItem.vendor != msg.sender, "Owner cant buy his nft");

        // Покупка производится за токены! Поэтому сначала переводим токены на контракт
        _Token.transferFrom(msg.sender, address(this), _ListItem.price);
        // отправляем nft покупателю
        _NFT.transferFrom(address(this), msg.sender, _tokenID);
        // ЗАТИРАЕМ ДАННЫЕ
        delete sListItem[_tokenID];
        emit BuyItem(_ListItem.vendor, msg.sender, _tokenID, _ListItem.price);
    }

    // Функция cancel() - отмена продажи выставленного предмета
    function cancel(uint256 _tokenID) public {
        // Только овнер может отменить продажу
        require(
            sListItem[_tokenID].vendor == msg.sender,
            "Only owner can cancel sell"
        );
        // отправляем nft владельцу
        _NFT.transferFrom(address(this), sListItem[_tokenID].vendor, _tokenID);
        // ЗАТИРАЕМ ДАННЫЕ
        delete sListItem[_tokenID];
        emit Cancel(msg.sender, _tokenID);
    }

    // Функция listItemOnAuction() - выставка предмета на продажу в аукционе.
    function listItemOnAuction(uint256 _tokenID, uint256 _startbidPrice)
        public
        onlyOwnerNFT(_tokenID)
    {
        // отправляем nft на контракт
        _NFT.transferFrom(msg.sender, address(this), _tokenID);

        // Заполняем лот на аукционе
        sListAuction[_tokenID] = _sAuction({
            vendor: msg.sender, // Продавец
            auctionStartTime: block.timestamp, // время старта
            bidPrice: _startbidPrice, // Запоминаем стартовую цену
            lastBuyer: address(0x0), // Пока нет последнего покупателя
            numBid: 0 // Количество ставок
        });
        emit ListItemOnAuction(
            msg.sender,
            sListAuction[_tokenID].auctionStartTime,
            _tokenID,
            _startbidPrice
        );
    }

    // Функция makeBid() - сделать ставку на предмет аукциона с определенным id.
    function makeBid(uint256 _tokenID, uint256 _price) public {
        require(
            sListAuction[_tokenID].auctionStartTime + durationAuction >
                block.timestamp,
            "Auction ended"
        );
        // стоимость превышает предыдущую ставку ?
        require(
            sListAuction[_tokenID].bidPrice < _price,
            "Your price must be more than the minimum bid"
        );
        // переводим токены на контракт
        _Token.transferFrom(msg.sender, address(this), _price);

        // если это НЕ ПЕРВАЯ ставка то возвращаем токены предыдущему бидеру
        if (sListAuction[_tokenID].lastBuyer != address(0x0)) {
            _Token.transfer(
                sListAuction[_tokenID].lastBuyer,
                sListAuction[_tokenID].bidPrice
            );
        }

        sListAuction[_tokenID].bidPrice = _price;
        sListAuction[_tokenID].lastBuyer = msg.sender;
        sListAuction[_tokenID].numBid++;
        emit MakeBid(msg.sender, _tokenID, _price);
    }

    // Функция finishAuction() - завершить аукцион и отправить НФТ победителю
    function finishAuction(uint256 _tokenID) public auctionTimeEnded(_tokenID) {
        if (sListAuction[_tokenID].numBid >= countBidsForComplete) {
            // Две и более ставок
            // NFT бидеру а токены продавцу
            _NFT.transferFrom(
                address(this),
                sListAuction[_tokenID].lastBuyer,
                _tokenID
            );
            _Token.transfer(
                sListAuction[_tokenID].vendor,
                sListAuction[_tokenID].bidPrice
            );
            emit FinishAuction(
                sListAuction[_tokenID].vendor,
                sListAuction[_tokenID].lastBuyer,
                _tokenID,
                sListAuction[_tokenID].bidPrice
            );
        } else {
            // Меньше двух ставок
            // NFT продавцу а если были ставки то токены возвращаем последнему бидеру
            _NFT.transferFrom(
                address(this),
                sListAuction[_tokenID].vendor,
                _tokenID
            );
            if (sListAuction[_tokenID].lastBuyer != address(0x0)) {
                _Token.transfer(
                    sListAuction[_tokenID].lastBuyer,
                    sListAuction[_tokenID].bidPrice
                );
            }
        }
        // ЗАТИРАЕМ ДАННЫЕ
        delete sListAuction[_tokenID];
    }

    // Функция cancelAuction() - отменить аукцион
    function cancelAuction(uint256 _tokenID) public auctionTimeEnded(_tokenID) {
        require(
            msg.sender == sListAuction[_tokenID].vendor,
            "Only owner can cancel auction"
        );
        // отправляем nft и токены
        _NFT.transferFrom(
            address(this),
            sListAuction[_tokenID].vendor,
            _tokenID
        );
        if (sListAuction[_tokenID].lastBuyer != address(0x0)) {
            _Token.transfer(
                sListAuction[_tokenID].lastBuyer,
                sListAuction[_tokenID].bidPrice
            );
        }

        // ЗАТИРАЕМ ДАННЫЕ
        delete sListAuction[_tokenID];
        emit CancelAuction(_tokenID);
    }

    // ЭВЕНТЫ
    event ListItem(
        address indexed vendor,
        uint256 indexed tokenID,
        uint256 price
    );
    event BuyItem(
        address indexed vendor,
        address indexed buyer,
        uint256 indexed tokenID,
        uint256 price
    );
    event Cancel(address indexed vendor, uint256 indexed tokenID);
    event ListItemOnAuction(
        address indexed vendor,
        uint256 indexed auctionStartTime,
        uint256 indexed tokenID,
        uint256 price
    );
    event MakeBid(
        address indexed buyer,
        uint256 indexed tokenID,
        uint256 price
    );
    event FinishAuction(
        address indexed vendor,
        address indexed buyer,
        uint256 indexed tokenID,
        uint256 price
    );
    event CancelAuction(uint256 indexed tokenID);
    event CreateItem(
        address indexed owner,
        uint256 indexed tokenID,
        string uri
    );
    //   function deleteContract() public payable onlyOwner {
    //        address payable addr = payable(msg.sender);
    //       selfdestruct(addr);
    //    }
}

/*
Техническое задание на неделю 4 (маркетплэйс)
Написать контракт маркетплейса, который должен включать в себя функцию создания NFT, а также функционал аукциона.
-Написать контракт маркетплейса NFT
-Написать полноценные тесты к контракту
-Написать скрипт деплоя
-Задеплоить в тестовую сеть
-Написать таск на mint
-Верифицировать контракт

Требования  
-Функция createItem() - создание нового предмета, обращается к контракту NFT и вызывает функцию mint.
-Функция mint(), доступ к которой должен иметь только контракт маркетплейса
-Функция listItem() - выставка на продажу предмета.
-Функция buyItem() - покупка предмета.
-Функция cancel() - отмена продажи выставленного предмета
-Функция listItemOnAuction() - выставка предмета на продажу в аукционе.
-Функция makeBid() - сделать ставку на предмет аукциона с определенным id.
-Функция finishAuction() - завершить аукцион и отправить НФТ победителю
-Функция cancelAuction() - отменить аукцион

dev, [16.03.2022 9:06]
Аукцион длится 3 дня с момента старта аукциона. В течении этого срока аукцион не может быть отменен. 
В случае если по истечению срока набирается более двух ставок аукцион считается 
состоявшимся и создатель аукциона его завершает (НФТ переходит к последнему биддеру и токены создателю аукциона). 
В противном случае токены возвращаются последнему биддеру, а НФТ остается у создателя.

Дедлайн 18,03,2022
*/
