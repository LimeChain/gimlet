
use anchor_lang::prelude::*;

pub fn _multiply(ctx: Context<Multiply>) -> Result<()> {
  msg!("Greetings from: {:?}", ctx.program_id);
  let x = 15;
  let y = 21;
  let multiply_result = x * y;
  msg!("Multiply is {:?}", multiply_result);
  Ok(())
}

#[derive(Accounts)]
pub struct Multiply {
    
}