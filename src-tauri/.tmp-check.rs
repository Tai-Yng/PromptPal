fn main() {
    // 模拟 check_whitelist 对 ~/.zcode/cli/config.json 的行为
    let home = dirs::home_dir().unwrap();
    let p = home.join(".zcode").join("cli").join("config.json");
    println!("exists: {}", p.exists());
    match p.canonicalize() {
        Ok(c) => println!("canonical: {}", c.display()),
        Err(e) => println!("canonicalize FAILED: {}", e),
    }
}
