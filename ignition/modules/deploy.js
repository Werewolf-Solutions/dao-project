const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Deploy Token
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();
  console.log("Token deployed to:", token.address);

  // Deploy DAO
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(token.address, deployer.address);
  await dao.deployed();
  console.log("DAO deployed to:", dao.address);

  // Set DAO in Token contract
  await token.setDAO(dao.address);

  // Deploy Token Sale
  const TokenSale = await ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(
    token.address,
    ethers.utils.parseEther("0.5")
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
