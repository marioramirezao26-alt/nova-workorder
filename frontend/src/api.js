import axios from 'axios';

// En desarrollo, el proxy de Vite envía /api al backend; VITE_API_URL permite apuntar a otro servidor.
export const API_URL = `${import.meta.env.VITE_API_URL || ''}/api`;

// Cliente de la API con el token; `onSessionLost` se llama si la sesión venció o la empresa quedó suspendida.
export const createApi = (token, onSessionLost) => {
  const api = axios.create({ baseURL: API_URL, headers: { Authorization: token ? `Bearer ${token}` : '' } });
  api.interceptors.response.use(undefined, (error) => {
    const status = error.response?.status;
    if (token && (status === 401 || status === 402)) onSessionLost(status === 402 ? error.response.data?.message : null);
    return Promise.reject(error);
  });
  return api;
};

// El mensaje de error más útil que devolvió la API.
export const errorMessage = (error, fallback) =>
  error.response?.data?.errors?.[0]?.message || error.response?.data?.message || fallback;
