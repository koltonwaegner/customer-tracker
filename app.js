let customers = JSON.parse(localStorage.getItem("customers")) || [];

renderCustomers();

function addCustomer() {
  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  const date = document.getElementById("date").value;
  const notes = document.getElementById("notes").value;

  const customer = {
    id: Date.now(),
    name,
    phone,
    date,
    notes
  };

  customers.push(customer);
  localStorage.setItem("customers", JSON.stringify(customers));

  renderCustomers();
  clearInputs();
}

function renderCustomers() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  customers.forEach(c => {
    const div = document.createElement("div");
    div.className = "customer";

    div.innerHTML = `
      <strong>${c.name}</strong><br/>
      📞 ${c.phone}<br/>
      📅 ${c.date}<br/>
      📝 ${c.notes}<br/>
      <button onclick="deleteCustomer(${c.id})">Delete</button>
    `;

    list.appendChild(div);
  });
}

function deleteCustomer(id) {
  customers = customers.filter(c => c.id !== id);
  localStorage.setItem("customers", JSON.stringify(customers));
  renderCustomers();
}

function clearInputs() {
  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("date").value = "";
  document.getElementById("notes").value = "";
}