// Test file for at_mentioned event
function greetUser(name) {
  console.log(`Hello, ${name}!`);
  return `Welcome to claude-term, ${name}`;
}

const users = ['Alice', 'Bob', 'Charlie'];
users.forEach(user => greetUser(user));

module.exports = { greetUser };