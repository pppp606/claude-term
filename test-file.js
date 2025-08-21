// Test file for at_mentioned event
function greetUser(name) {
  console.log(`Hello, ${name}! Nice to see you here.`);
  return `Welcome to claude-term, ${name}`;
}

function farewellUser(name) {
  console.log(`Goodbye, ${name}! Thanks for using claude-term.`);
  return `See you later, ${name}`;
}

const users = ['Alice', 'Bob', 'Charlie'];
users.forEach(user => greetUser(user));

module.exports = { greetUser, farewellUser };