use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg, pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("lorem ipsum");

    let stop = 1;
    msg!("stop: {}", stop);
    
    let x = 15;
    let y = 16;
    let sum = x + y;
    msg!("Sum of x and y is: {}", sum);
    msg!("Hello, Solana!");
    Ok(())
}