// After deploying the worker, put its URL here (e.g. https://wunschliste-api.DEIN-NAME.workers.dev).
const PRODUCTION_API = "https://wunschliste-api.i-farenbruch.workers.dev";

window.API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:8787"
  : PRODUCTION_API;
