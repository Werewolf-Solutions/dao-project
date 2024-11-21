import hre from "hardhat";

async function main() {
  const WerewolfTokenV1 = await hre.ethers.getContractFactory(
    "WerewolfTokenV1"
  );
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const DAO = await hre.ethers.getContractFactory("DAO");
  const TokenSale = await hre.ethers.getContractFactory("TokenSale");
  const Timelock = await hre.ethers.getContractFactory("Timelock");
  const [founder, addr1, addr2] = await hre.ethers.getSigners();

  const votingPeriod = 24 * 60 * 60 * 2; // 2 days

  // Deploy the treasury contract first
  const treasury = await Treasury.deploy(founder.address); // Deployer will be owner
  await treasury.deployed();

  const timelock = await Timelock.deploy(founder.address, votingPeriod);
  await timelock.deployed();

  // Deploy the werewolfToken contract with the Treasury address
  const werewolfToken = await WerewolfTokenV1.deploy(
    treasury.address,
    timelock.address,
    founder.address,
    addr1.address
  );
  await werewolfToken.deployed();

  // Deploy the DAO contract with WerewolfTokenV1 and Treasury addresses
  const dao = await DAO.deploy(
    werewolfToken.address,
    treasury.address,
    timelock.address
  );
  await dao.deployed();

  // Deploy the werewolfToken sale contract with price 0.5 ETH per werewolfToken
  const tokenSale = await TokenSale.deploy(
    werewolfToken.address,
    treasury.address,
    timelock.address
  );
  await tokenSale.deployed();

  // Set the DAO as the owner of the WerewolfTokenV1 and Treasury
  await werewolfToken.transferOwnership(timelock.address);
  await treasury.transferOwnership(timelock.address);

  // Encode the function parameters for `setpendingAdmin()`
  const functionParams = hre.ethers.utils.defaultAbiCoder.encode(
    ["address"],
    [dao.address]
  );

  // Approve the DAO to spend tokens for proposal cost, if required
  const proposalCost = hre.ethers.utils.parseUnits("10", 18);
  await werewolfToken.connect(founder).approve(dao.address, proposalCost);

  // Create the proposal through the DAO
  await dao.connect(founder).createProposal(
    [timelock.address], // Target contract
    ["setPendingAdmin(address)"], // Function signature
    [functionParams] // Function arguments encoded
  );

  // Simulate delay for voting period
  await simulateBlocks(votingPeriod);

  await dao.connect(addr1).vote(0, true);
  await dao.connect(founder).vote(0, true);

  // await timelock.connect(founder).executeTransaction(
  //   timelock.address, // Target contract
  //   "setPendingAdmin(address)", // Function signature
  //   functionParams // Function arguments encoded
  // );

  await simulateBlocks(votingPeriod * 2);

  // Execute the proposals after voting
  await dao.connect(founder).__acceptAdmin();

  // console.log(`DAO address: ${dao.address}`);
  // console.log(`werewolfToken owner: ${await werewolfToken.owner()}`);
  // console.log(`werewolfToken sale owner: ${await tokenSale.owner()}`);
  // console.log(`treasury owner: ${await treasury.owner()}`);
  // console.log(`Timelock admin: ${await timelock.admin()}`);
}

// Simulate blocks
async function simulateBlocks(delay) {
  await hre.network.provider.send("evm_increaseTime", [delay]);
  await hre.network.provider.send("evm_mine");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
