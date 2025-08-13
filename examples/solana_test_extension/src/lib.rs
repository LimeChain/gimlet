use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg, pubkey::Pubkey,
};

entrypoint!(process_instruction);

#[no_mangle]
pub fn process_instruction(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.is_empty() {
        msg!("Instruction data too short");
        return Err(solana_program::program_error::ProgramError::InvalidInstructionData);
    }
    let opcode = instruction_data[0];
    match opcode {
        0 => add_instruction(),
        1 => subtract_instruction(),
        2 => multiply_instruction(),
        3 => divide_instruction(),
        _ => {
            msg!("Unknown opcode: {}", opcode);
            Err(solana_program::program_error::ProgramError::InvalidInstructionData)
        }
    }
}

#[no_mangle]
#[inline(never)]
fn add_instruction() -> ProgramResult {
    msg!("Greetings");
    let x = 15;
    let y = 21;
    let result = x + y;
    msg!("Addition: {} + {} = {}", x, y, result);
    Ok(())
}

#[no_mangle]
#[inline(never)]
fn subtract_instruction() -> ProgramResult {
    let x = 15;
    let y = 21;
    let result = x - y;
    msg!("Subtraction: {} - {} = {}", x, y, result);
    Ok(())
}

#[no_mangle]
#[inline(never)]
fn multiply_instruction() -> ProgramResult {
    let x = 15;
    let y = 21;
    let result = x * y;
    msg!("Multiplication: {} * {} = {}", x, y, result);
    Ok(())
}

#[no_mangle]
#[inline(never)]
fn divide_instruction() -> ProgramResult {
    let x = 15;
    let y = 21;
    let result = x / y;
    msg!("Division: {} / {} = {}", x, y, result);
    Ok(())
}