import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Deploy Token
  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();
  console.log("Token deployed to:", token.address);

  // Deploy DAO
  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(token.address, deployer.address);
  await dao.deployed();
  console.log("DAO deployed to:", dao.address);

  // Set DAO in Token contract
  await token.setDAO(dao.address);

  // Deploy Token Sale
  const TokenSale = await hre.ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(
    token.address,
    hre.ethers.utils.parseEther("0.5")
  );
  await tokenSale.deployed();
  console.log("TokenSale deployed to:", tokenSale.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
