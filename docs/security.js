/* AgentBoard security helpers: warn when the contract address differs from
   the official one. app.js is NOT modified. Warning texts come from the
   i18n dictionary (data-i18n); this script only toggles visibility.
   Token custom sudah dihapus dari UI (allowlist BNB + USDC saja, fail-closed),
   jadi tidak ada lagi peringatan token custom di sini. */
(function () {
  "use strict";
  var OFFICIAL = "0x47751df28f9c62faebbfadf191439495f1bff70e";
  var addrInput = document.getElementById("contractAddress");
  var addrWarn = document.getElementById("addrWarn");
  function checkAddr() {
    if (!addrInput || !addrWarn) return;
    addrWarn.hidden = (addrInput.value.trim().toLowerCase() === OFFICIAL.toLowerCase());
  }
  if (addrInput) {
    addrInput.addEventListener("input", checkAddr);
    checkAddr();
  }
})();
