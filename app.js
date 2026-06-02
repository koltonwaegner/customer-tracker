let customers = JSON.parse(localStorage.getItem("customers")) || [];

function save() {
  localStorage.setItem("customers", JSON.stringify(customers));
  render();
}

function addCustomerPrompt() {
  const name = prompt("Customer name:");
  if (!name) return;

  const email = prompt("Customer email:");
  if (!email) return;

  customers.push({ name, email });
  save();
}

function deleteCustomer(index) {
  customers.splice(index, 1);
  save();
}

function render() {
  const list = document.getElementById("customerList");
  list.innerHTML = "";

  customers.forEach((c, i) => {
    list.innerHTML += `
      <div class="card">
        <h3>${c.name}</h3>
        <p>${c.email}</p>
        <button onclick="deleteCustomer(${i})">Delete</button>
      </div>
    `;
  });
}

render();
