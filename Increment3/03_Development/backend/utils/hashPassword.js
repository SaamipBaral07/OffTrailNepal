import bcrypt from "bcrypt";

const run = async () => {
  const password = "admin123"; // choose your admin password
  const hash = await bcrypt.hash(password, 10);
  console.log("HASHED PASSWORD:", hash);
};

run();
