import { PublicKey, PublicKeyInitData, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import { Connection, Wallet } from '@metaplex/js';
import { AuctionHouseProgram } from '../AuctionHouseProgram';
import { AuctionHouseAccount } from '../AuctionHouseAccount';

interface CreateAuctionHouseParams {
  connection: Connection;
  wallet: Wallet;
  sellerFeeBasisPoints: number;
  canChangeSalePrice?: boolean;
  requiresSignOff?: boolean;
  treasuryWithdrawalDestination?: PublicKeyInitData;
  feeWithdrawalDestination?: PublicKeyInitData;
  treasuryMint?: PublicKeyInitData;
}

export const createAuctionHouse = async (params: CreateAuctionHouseParams): Promise<anchor.web3.TransactionInstruction> => {
  const {
    connection,
    wallet,
    sellerFeeBasisPoints,
    canChangeSalePrice,
    requiresSignOff,
    treasuryWithdrawalDestination,
    feeWithdrawalDestination,
    treasuryMint,
  } = params;

  const mustSignOff = requiresSignOff || false;
  const ableToChangePrice = canChangeSalePrice || false;

  const provider = new anchor.Provider(connection, wallet, {
    preflightCommitment: 'recent',
  });

  const anchorProgram = new AuctionHouseProgram(provider);

  const twdKey = treasuryWithdrawalDestination
    ? new PublicKey(treasuryWithdrawalDestination)
    : wallet.publicKey;

  const fwdKey = feeWithdrawalDestination
    ? new PublicKey(feeWithdrawalDestination)
    : wallet.publicKey;

  const tMintKey = treasuryMint ? new PublicKey(treasuryMint) : NATIVE_MINT;

  const twdAta = tMintKey.equals(NATIVE_MINT)
    ? twdKey
    : (await AuctionHouseAccount.getAtaForMint(tMintKey, twdKey))[0];

  const [auctionHouse, bump] = await AuctionHouseAccount.getAuctionHouse(
    wallet.publicKey,
    tMintKey,
  );

  const [feeAccount, feeBump] = await AuctionHouseAccount.getAuctionHouseFeeAcct(auctionHouse);

  const [treasuryAccount, treasuryBump] = await AuctionHouseAccount.getAuctionHouseTreasuryAcct(
    auctionHouse,
  );

  return anchorProgram.instruction.createAuctionHouse(
    bump,
    feeBump,
    treasuryBump,
    sellerFeeBasisPoints,
    mustSignOff,
    ableToChangePrice,
    {
      accounts: {
        treasuryMint: tMintKey,
        payer: wallet.publicKey,
        authority: wallet.publicKey,
        feeWithdrawalDestination: fwdKey,
        treasuryWithdrawalDestination: twdAta,
        treasuryWithdrawalDestinationOwner: twdKey,
        auctionHouse,
        auctionHouseFeeAccount: feeAccount,
        auctionHouseTreasury: treasuryAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
    },
  );
};