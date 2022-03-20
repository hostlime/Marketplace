
import { task } from "hardhat/config";


// npx hardhat mint --contract 0x1868F94Cce81115a9c30f7BBd64CA41024EdEA3E --uri https://gateway.pinata.cloud/ipfs/QmWWXb1n1avqmxfQpS3htjgFi7rufJYBpHCTUE9UEbhq3f  --network rinkeby
task("mint", "mint NFT (ERC720)")
    .addParam("contract", "address of deployed Marketplace")
    .addParam("uri", "URI to ipfs json")
    .setAction(async (taskArgs, hre) => {
        const marketplace = await hre.ethers.getContractAt("Marketplace", taskArgs.contract)
        await marketplace.createItem(taskArgs.uri)
    })