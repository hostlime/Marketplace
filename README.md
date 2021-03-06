# NFT Marketplace
Смарт-контракт маркетплейса, который включает в себя функции создания NFT, а также функционал продажи и аукциона.
 + NFT ERC721 deployed to: https://rinkeby.etherscan.io/address/0x23E454eFaf197a3970FB895Acb28d822a2c3Ec92
 + ERC20 token deployed to: https://rinkeby.etherscan.io/address/0x3FF29861C2C14a811bd9eBc5596F2b3282b06f31
 + Marketplace deployed to: https://rinkeby.etherscan.io/address/0x1868F94Cce81115a9c30f7BBd64CA41024EdEA3E
##### Функционал:
- Функция createItem() - создание нового предмета, обращается к контракту NFT и вызывает функцию mint.
- Функция mint(), доступ к которой должен иметь только контракт маркетплейса
- Функция listItem() - выставка на продажу предмета.
- Функция buyItem() - покупка предмета.
- Функция cancel() - отмена продажи выставленного предмета
- Функция listItemOnAuction() - выставка предмета на продажу в аукционе.
- Функция makeBid() - сделать ставку на предмет аукциона с определенным id.
- Функция finishAuction() - завершить аукцион и отправить НФТ победителю
- Функция cancelAuction() - отменить аукцион


##### npx hardhat test:
```shell
Marketplace
    ✔ Checking that contract NFT is deployed
    ✔ Checking that contract Token ERC20 is deployed
    ✔ Checking that contract Marketplace is deployed
    ✔ Checking that marketplace has role a MARKET_ROLE
    ✔ Checking function createItem()
    ✔ Checking function listItem() (168ms)
    ✔ Checking function buyItem() (232ms)
    ✔ Checking function cancel() (123ms)
    ✔ Checking function listItemOnAuction() (98ms)
    ✔ Checking function makeBid() (398ms)
    ✔ Checking function finishAuction() no bid (198ms)
    ✔ Checking function finishAuction() 1 bid (232ms)
    ✔ Checking function finishAuction() 3 bid (370ms)
    ✔ Checking function cancelAuction() has bid (290ms)
    ✔ Checking function cancelAuction() has not bid (137ms)
```
##### npx hardhat coverage:
```shell
------------------|----------|----------|----------|----------|----------------|
File              |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
------------------|----------|----------|----------|----------|----------------|
  Marketplace.sol |      100 |      100 |      100 |      100 |                |
------------------|----------|----------|----------|----------|----------------|
------------------|----------|----------|----------|----------|----------------|
```