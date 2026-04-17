import bcrypt from "bcrypt";

const run = async () => {
  const password = String(process.argv[2] || process.env.PASSWORD_TO_HASH || "").trim();
  const roundsArg = process.argv[3] || process.env.BCRYPT_ROUNDS || "10";
  const rounds = Number.parseInt(roundsArg, 10);

  if (!password) {
    console.error("Usage: node src/utils/hashPassword.js \"YourStrongPassword\" [rounds]");
    console.error("Or set PASSWORD_TO_HASH in environment variables.");
    process.exitCode = 1;
    return;
  }

  if (!Number.isInteger(rounds) || rounds < 8 || rounds > 14) {
    console.error("Invalid bcrypt rounds. Use an integer between 8 and 14.");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, rounds);
  console.log("HASHED PASSWORD:", hash);
};

run().catch((error) => {
  console.error("Failed to hash password:", error.message);
  process.exitCode = 1;
});
