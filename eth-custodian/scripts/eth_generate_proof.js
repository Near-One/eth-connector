const hre = require('hardhat');
const ethereumConfig = require('./json/ethereum-config.json');

const Tree = require('merkle-patricia-tree') ;
const { encode } = require('eth-util-lite');
const { Header, Proof, Receipt, Log } = require('eth-object');
const { promisfy } = require('promisfy');
const utils = require('ethereumjs-util');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');
const Path = require('path')
const fs = require('fs').promises


class BorshProof {
  constructor (proof) {
    Object.assign(this, proof)
  }
};

const proofBorshSchema = new Map([
  [BorshProof, {
    kind: 'struct',
    fields: [
      ['log_index', 'u64'],
      ['log_entry_data', ['u8']],
      ['receipt_index', 'u64'],
      ['receipt_data', ['u8']],
      ['header_data', ['u8']],
      ['proof', [['u8']]]
    ]
  }]
]);

const filenamePrefix = 'proofdata_' + ethereumConfig.nearEvmAccount;

async function findProof (depositTxHash, depositedToNear) {
    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    console.log(`EthCustodian address: ${ethCustodian.address}`);
    console.log(`Generating the proof for TX with hash: ${depositTxHash}`);

    const receipt = await hre.ethers.provider.getTransactionReceipt(depositTxHash);
    receipt.cumulativeGasUsed = receipt.cumulativeGasUsed.toNumber();
    const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
    const tree = await buildTree(block);

    const proof = await extractProof(
        block,
        tree,
        receipt.transactionIndex
    );

    const eventFilter = depositedToNear
        ? ethCustodian.filters.DepositedToNear(null)
        : ethCustodian.filters.DepositedToEVM(null);
    const blockFrom = receipt.blockNumber;
    const blockTo = receipt.blockNumber;
    const depositedEvents = await ethCustodian.queryFilter(eventFilter, blockFrom, blockTo);

    depositedEvents.forEach(element => console.log(`Deposit event: ${JSON.stringify(element)}`));
    const log = depositedEvents
        .filter(depositedEvent => depositedEvent.transactionHash == depositTxHash)[0];

    const logIndexInArray = receipt.logs.findIndex(
        l => l.logIndex === log.logIndex
    );

    const formattedProof = new BorshProof({
        log_index: logIndexInArray,
        log_entry_data: Array.from(Log.fromObject(log).serialize()),
        receipt_index: proof.txIndex,
        receipt_data: Array.from(Receipt.fromObject(receipt).serialize()),
        header_data: Array.from(proof.header_rlp),
        proof: Array.from(proof.receiptProof).map(utils.rlp.encode).map(b => Array.from(b))
    });

    const skipBridgeCall = false;
    const args = {
        log_index: logIndexInArray,
        log_entry_data: formattedProof.log_entry_data,
        receipt_index: formattedProof.receipt_index,
        receipt_data: formattedProof.receipt_data,
        header_data: formattedProof.header_data,
        proof: formattedProof.proof,
        skip_bridge_call: skipBridgeCall
    }

    const path = "build/proofs";
    const file = Path.join(path, `${filenamePrefix}_${args.receipt_index}_${args.log_index}_${depositTxHash}.json`)
    await fs.writeFile(file, JSON.stringify(args))
    console.log(`Proof has been successfully generated and saved at ${file}`);

    //return serializeBorsh(proofBorshSchema, formattedProof);
    return args;
}

async function buildTree (block) {
    const blockReceipts = await Promise.all(
        block.transactions.map(t =>
                               hre.ethers.provider.getTransactionReceipt(t))
    );

    // Build a Patricia Merkle Trie
    const tree = new Tree();
    await Promise.all(
        blockReceipts.map(receipt => {
            const path = encode(receipt.transactionIndex)
            receipt.cumulativeGasUsed = receipt.cumulativeGasUsed.toNumber();
            const serializedReceipt = Receipt.fromObject(receipt).serialize()
            return promisfy(tree.put, tree)(path, serializedReceipt)
        })
    );

    return tree;
}

async function extractProof (block, tree, transactionIndex) {
    const [, , stack] = await promisfy(
        tree.findPath,
        tree
    )(encode(transactionIndex));

    const blockData = await hre.ethers.provider.send(
        'eth_getBlockByNumber',
        [ethers.BigNumber.from(block.number)._hex, true]);

    // Correctly compose and encode the header.
    const header = Header.fromObject(blockData);
    return {
        header_rlp: header.serialize(),
        receiptProof: Proof.fromStack(stack),
        txIndex: transactionIndex
    };
}

exports.findProof = findProof;
