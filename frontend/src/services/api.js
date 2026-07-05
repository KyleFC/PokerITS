import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token into requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle automatic token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/token/')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          // Request a new access token
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });
          
          const { access } = response.data;
          localStorage.setItem('access_token', access);
          
          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh token expired or invalid, log out
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/token/', { username, password });
    if (response.data.access) {
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
    }
    return response.data;
  },
  
  register: async (username, email, password, passwordConfirm) => {
    const response = await api.post('/auth/register/', {
      username,
      email,
      password,
      password_confirm: passwordConfirm,
    });
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
  
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },
};

export const studentService = {
  getProfile: async () => {
    const response = await api.get('/student/profile/');
    return response.data;
  },
  
  submitQuizResult: async (scenarioId, answer) => {
    // The server grades the answer against its own answer key and returns
    // { correct, correct_answer, explanation, ev_notes, skill, profile }.
    const response = await api.post('/student/quiz-result/', {
      scenario_id: scenarioId,
      answer,
    });
    return response.data;
  },
  
  getHistory: async (skill = '') => {
    const url = skill ? `/student/history/?skill=${skill}` : '/student/history/';
    const response = await api.get(url);
    return response.data;
  },
};

export const pokerService = {
  getScenarios: async (skill = '') => {
    const url = skill ? `/poker/scenarios/?skill=${skill}` : '/poker/scenarios/';
    const response = await api.get(url);
    return response.data;
  },
  
  getScenario: async (id) => {
    const response = await api.get(`/poker/scenarios/${id}/`);
    return response.data;
  },
};

export default api;
