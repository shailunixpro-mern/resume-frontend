import axios from "axios";

const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL;

const API = axios.create({
  baseURL: backendBaseUrl,
  timeout: 10000,
});

API.interceptors.request.use((config) => {
  if (!backendBaseUrl) {
    return Promise.reject(new Error("NEXT_PUBLIC_API_URL is not configured"));
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

export default API;
