require('dotenv').config();

const { ethers } = require('hardhat');

//const ETH_CUSTODIAN = '0x88657f6D4c4bbDB193C2b0B78DD74cD38479f819';
const ETH_CUSTODIAN = '0xb9f7219e434EAA7021Ae5f9Ecd0CaBc2405447A3';
const ZERO_CHAIN_ID = 0;
const AURORA_TESTNET_CHAIN_ID = 1313161555;

const ETH_RECIPIENT = '0x891B2749238B27fF58e951088e55b04de71Dc374'; // Ropsten
const NEAR_RECIPIENT = 'testlocal.testnet';

const wallet = new ethers.Wallet(process.env.ROPSTEN_PRIVATE_KEY);

const AURORA_DOMAIN = {
    name: 'Aurora-Engine domain',
    version: '1.0',
    //chainId: AURORA_TESTNET_CHAIN_ID,
    chainId: ZERO_CHAIN_ID,
    verifyingContract: ETH_CUSTODIAN
};

const WITHDRAW_FROM_EVM_TYPE = {
    WithdrawFromEVMRequest: [
        { name: 'ethRecipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'fee', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
    ]
};

const TRANSFER_FROM_EVM_TO_NEAR_TYPE = {
    TransferFromEVMtoNearRequest: [
        { name: 'nearRecipient', type: 'string' },
        { name: 'amount', type: 'uint256' },
        { name: 'fee', type: 'uint256' },
    ]
};

async function generateTypedSignatureFor(type, value) {
    const encodedData = await ethers.utils._TypedDataEncoder.encode(AURORA_DOMAIN, type, value);
    console.log(`EncodedData: ${encodedData}`);

    const digest = await ethers.utils._TypedDataEncoder.hash(AURORA_DOMAIN, type, value);
    console.log(`Digest: ${digest}`);

    const keccakDigest = ethers.utils.keccak256(encodedData);
    console.log(`Digest (keccak-256 of encodedData): ${keccakDigest}`);

    const ethersSignature = await wallet._signTypedData(AURORA_DOMAIN, type, value);
    console.log(`EIP-712 signature: ${ethersSignature}`);

    const recoverAddress = ethers.utils.recoverAddress(digest, ethersSignature);
    console.log(`Wallet address: ${wallet.address}`);
    console.log(`Recover address: ${recoverAddress}`);
}

async function main() {
    let amount = 7654321;
    let fee = 321;

    console.log(`EIP-712 Domain ${JSON.stringify(AURORA_DOMAIN, null, 2)}`);
    console.log();
    console.log(`WithdrawFromEVMRequest type ${JSON.stringify(WITHDRAW_FROM_EVM_TYPE, null, 2)}`);
    console.log();

    const withdrawFromEVMRequest = {
        ethRecipient: ETH_RECIPIENT,
        amount: amount,
        fee: fee,
        verifyingContract: ETH_CUSTODIAN,
    };
    console.log(`WithdrawFromEVMRequest: ${JSON.stringify(withdrawFromEVMRequest, null, 2)} \n`);

    await generateTypedSignatureFor(WITHDRAW_FROM_EVM_TYPE, withdrawFromEVMRequest);

    console.log ('--------------------------------------------------');
    console.log(`TransferFromEVMtoNearRequest type ${JSON.stringify(TRANSFER_FROM_EVM_TO_NEAR_TYPE, null, 2)}`);
    console.log();

    const transferFromEVMtoNearRequest = {
        nearRecipient: NEAR_RECIPIENT,
        amount: amount,
        fee: fee,
    };
    console.log(`TransferFromEVMtoNearRequest: ${JSON.stringify(transferFromEVMtoNearRequest, null, 2)} \n`);

    await generateTypedSignatureFor(TRANSFER_FROM_EVM_TO_NEAR_TYPE, transferFromEVMtoNearRequest);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
