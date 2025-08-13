import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ShipmentManagment } from "../target/types/shipment_managment";
import { generateInstruction } from "instruction-generator";

describe("shipment-managment", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.shipmentManagment as Program<ShipmentManagment>;
  const provider = anchor.getProvider();

  it("Initializes the counter", async () => {
    // Derive the counter PDA
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      program.programId
    );

    const initial_count = new anchor.BN(10);

    // Call the instruction
    const ix = program.methods
      .initializeCounter(initial_count)
      .accounts({
        counter: counterPda,
        authority: provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      });

    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    
    generateInstruction(
      program.programId.toString(),
      "initialize_counter",
      ix_data,
      [
        { key: counterPda.toString(), is_signer: false, is_writable: true },
        { key: provider.publicKey.toString(), is_signer: true, is_writable: true },
        { key: anchor.web3.SystemProgram.programId.toString(), is_signer: false, is_writable: false }
      ],
    );
  });

  it("Should successfully create a shipment", async () => {
    // Derive the counter PDA
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      program.programId
    );

    const counterAccount = await program.account.counter.fetch(counterPda);
    const counterBytes = new anchor.BN(counterAccount.count).toArrayLike(Buffer, "le", 8);

    const [shipmentPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shipment"), counterBytes],
      program.programId
    );

    const ix = program.methods
      .createShipment()
      .accounts({
        counter: counterPda,
        shipment: shipmentPda,
        creator: provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      });

    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    
    generateInstruction(
      program.programId.toString(),
      "create_shipment",
      ix_data,
      [
        { key: counterPda.toString(), is_signer: false, is_writable: true },
        { key: shipmentPda.toString(), is_signer: false, is_writable: true },
        { key: provider.publicKey.toString(), is_signer: true, is_writable: true },
        { key: anchor.web3.SystemProgram.programId.toString(), is_signer: false, is_writable: false }
      ],
    );
  });

  it("Should successfully validate a shipment", async() => {
    // Derive the counter PDA
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      program.programId
    );

    const counterAccount = await program.account.counter.fetch(counterPda);
    const counterBytes = new anchor.BN(counterAccount.count).toArrayLike(Buffer, "le", 8);

    const [shipmentPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shipment"), counterBytes],
      program.programId
    );

    // 1. Create shipment
    await program.methods
      .createShipment()
      .accounts({
        counter: counterPda,
        shipment: shipmentPda,
        creator: provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // 2. Validate shipment
    const ix = program.methods
      .validateShipment()
      .accounts({
        shipment: shipmentPda,
        validator: provider.publicKey,
      });

    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();

    generateInstruction(
      program.programId.toString(),
      "validate_shipment",
      ix_data,
      [
        { key: shipmentPda.toString(), is_signer: false, is_writable: true },
        { key: provider.publicKey.toString(), is_signer: true, is_writable: true }
      ],
    );
  })

  it("Should successfully approve the shipment", async () => {
    // Derive the counter PDA
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      program.programId
    );

    const counterAccount = await program.account.counter.fetch(counterPda);
    const counterBytes = new anchor.BN(counterAccount.count).toArrayLike(Buffer, "le", 8);

    const [shipmentPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shipment"), counterBytes],
      program.programId
    );

    // 1. Create shipment
    await program.methods
      .createShipment()
      .accounts({
        counter: counterPda,
        shipment: shipmentPda,
        creator: provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // 2. Validate shipment
    await program.methods
      .validateShipment()
      .accounts({
        shipment: shipmentPda,
        validator: provider.publicKey,
      })
      .rpc();
    
    // Finally approve the shipment
    const ix = program.methods
      .approveShipment()
      .accounts({
        shipment: shipmentPda,
        approver: provider.publicKey,
      })

    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();

    generateInstruction(
      program.programId.toString(),
      "approve_shipment",
      ix_data,
      [
        { key: shipmentPda.toString(), is_signer: false, is_writable: true },
        { key: provider.publicKey.toString(), is_signer: true, is_writable: true }
      ],
    );
  });
});