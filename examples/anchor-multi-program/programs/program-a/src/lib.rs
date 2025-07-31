use anchor_lang::prelude::*;

declare_id!("4BYT5J61VNQPZnx29mU33WQpBxYBJmz6kgkhkmcetxRf");

#[program]
pub mod anchor_multi_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program A says hello!");
        Ok(())
    }

    pub fn add(ctx: Context<Add>, a: u32, b: u32) -> Result<()> {
        let result = a + b;
        msg!("Program A: {} + {} = {}", a, b, result);
        Ok(())
    }

    pub fn count_down(ctx: Context<CountDown>, start: u8) -> Result<()> {
        for i in (1..=start).rev() {
            msg!("Program A counting down: {}", i);
        }
        msg!("Program A: Blast off!");
        Ok(())
    }

    pub fn say_hello(ctx: Context<SayHello>, name: String) -> Result<()> {
        msg!("Program A says: Hello {}! Nice to meet you!", name);
        Ok(())
    }

    pub fn calculate_power(ctx: Context<CalculatePower>, base: u32, exp: u32) -> Result<()> {
        let result = base.pow(exp);
        msg!("Program A: {} ^ {} = {}", base, exp, result);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Add {}

#[derive(Accounts)]
pub struct CountDown {}

#[derive(Accounts)]
pub struct SayHello {}

#[derive(Accounts)]
pub struct CalculatePower {}
