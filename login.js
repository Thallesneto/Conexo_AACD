// Tela de Login – comportamento mínimo.
// Seleção de perfil (Equipe AACD / Parceiro) e checkbox funcionam só com HTML + CSS.

const form = document.querySelector(".login-form");
const passwordInput = document.getElementById("senha");
const passwordToggle = document.querySelector(".field__toggle");

// Mostrar / ocultar senha (botão do olho)
passwordToggle.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(isHidden));
  passwordToggle.setAttribute("aria-label", isHidden ? "Ocultar senha" : "Mostrar senha");
});

// Não há back-end ainda: impede que o envio recarregue a página.
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  // TODO: enviar `data` (perfil, email, senha, lembrar) para a API de autenticação.
  console.log("Login enviado:", { ...data, senha: "***" });
});
