"use strict";

const form = document.querySelector("#unlock-form");
const passwordField = document.querySelector("#password");
const status = document.querySelector("#status");
const button = form.querySelector("button");
const decodeBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = passwordField.value.trim();
  if (!password) {
    status.textContent = "Enter the assignment password.";
    passwordField.focus();
    return;
  }
  if (!window.crypto?.subtle) {
    status.textContent = "Open this page over HTTPS in a current browser.";
    return;
  }

  button.disabled = true;
  status.textContent = "Opening assignment…";
  let encrypted;
  try {
    const response = await fetch("materials.enc.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Download failed");
    encrypted = await response.json();
  } catch {
    status.textContent = "The materials could not be loaded. Check your connection and try again.";
    button.disabled = false;
    return;
  }

  try {
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: decodeBase64(encrypted.salt), iterations: encrypted.iterations, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(encrypted.iv) }, key, decodeBase64(encrypted.ciphertext)
    );
    const assignment = JSON.parse(new TextDecoder().decode(plaintext));
    const page = new DOMParser().parseFromString(assignment.html, "text/html");
    const zip = new Blob([decodeBase64(assignment.zip)], { type: "application/zip" });
    const download = page.querySelector("a.download");
    download.href = URL.createObjectURL(zip);
    download.download = "student-starter.zip";
    const home = page.createElement("a");
    home.href = "../../index.html";
    home.textContent = "CSCI 566 course home";
    const navigation = page.createElement("p");
    navigation.append(home);
    page.querySelector("main").prepend(navigation);
    page.querySelector("head").insertAdjacentHTML("beforeend", '<meta name="robots" content="noindex,nofollow">');
    passwordField.value = "";
    document.documentElement.replaceWith(page.documentElement);
    const heading = document.querySelector("h1");
    heading.tabIndex = -1;
    heading.focus();
    window.scrollTo(0, 0);
  } catch {
    status.textContent = "That password did not open the assignment. Check it and try again.";
    passwordField.focus();
    passwordField.select();
  } finally {
    button.disabled = false;
  }
});
