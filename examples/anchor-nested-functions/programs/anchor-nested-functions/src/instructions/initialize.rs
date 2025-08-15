
use anchor_lang::prelude::*;

pub fn _initialize(ctx: Context<Initialize>) -> Result<()> {
  msg!("Greetings from: {:?}", ctx.program_id);
  let x = 15;
  let y = 21;
  let sum = x + y;
  msg!("Sum is: {:?}", sum);
  Ok(())
}

#[derive(Accounts)]
pub struct Initialize {}
