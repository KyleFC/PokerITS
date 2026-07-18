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
          
          const { access, refresh } = response.data;
          localStorage.setItem('access_token', access);
          // The backend rotates refresh tokens (ROTATE_REFRESH_TOKENS=True):
          // each refresh response carries a new refresh token that must replace
          // the old one, otherwise the session hard-expires 7 days after login
          // no matter how active the user is.
          if (refresh) {
            localStorage.setItem('refresh_token', refresh);
          }

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
  
  getHistory: async (skill = '', page = 1) => {
    const params = new URLSearchParams();
    if (skill) params.set('skill', skill);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    const response = await api.get(`/student/history/${qs ? `?${qs}` : ''}`);
    // DRF-paginated: { count, next, previous, results }.
    return response.data;
  },

  // Walk the paginated observation log until exhausted (or a safety cap) and
  // return all observations oldest-first, ready to plot as a timeline.
  getFullHistory: async (skill = '', maxPages = 20) => {
    // Fetch page 1 first to learn the total count, then fetch the remaining
    // pages in parallel rather than walking them one blocking request at a
    // time (which serialized up to `maxPages` round-trips before the timeline
    // could render).
    const first = await studentService.getHistory(skill, 1);
    const all = [...first.results];
    const pageSize = first.results.length || 1;
    const totalPages = Math.min(maxPages, Math.ceil((first.count || 0) / pageSize));
    if (first.next && totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          studentService.getHistory(skill, i + 2)
        )
      );
      for (const data of rest) all.push(...data.results);
    }
    // The API serves newest-first; timelines want oldest-first.
    return all.reverse();
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

  // Fetch a freshly procedurally-generated scenario for infinite practice mode.
  // Pass a skill to drill it specifically; omit it to let the server pick,
  // biased toward the student's weakest BKT skills. The answer key is stripped
  // server-side, exactly like the static bank — grading still happens via
  // submitQuizResult against the seed encoded in the returned scenario id.
  generateScenario: async (skill = '') => {
    const url = skill ? `/poker/scenarios/generate/?skill=${skill}` : '/poker/scenarios/generate/';
    const response = await api.get(url);
    return response.data;
  },

  // Returns the scripted hand-replay frames that lead up to a scenario's
  // decision point: { frames, hero, seats, question_type, scenario }.
  // 404s for scenarios that have no gameplay script (callers should fall back
  // to the static quiz view).
  getScenarioReplay: async (id) => {
    const response = await api.get(`/poker/scenarios/${id}/replay/`);
    return response.data;
  },

  // Fetch the static preflop charts (6-max RFI + heads-up), expanded to hand
  // classes, for the range-viewer page. Same source of truth the graders use.
  getPreflopRanges: async () => {
    const response = await api.get('/poker/ranges/');
    return response.data;
  },

  // Deal a new live heads-up hand vs the rule-based bot. Returns
  // { hand_id, profile, frame } where frame is the first hero decision.
  startHand: async (profile = 'balanced', stack = 100) => {
    const response = await api.post('/poker/hands/', { profile, stack });
    return response.data;
  },

  // Submit the hero's action for a live hand. The backend advances the bot
  // inline and returns { frame, observation, complete, profile }. `action` is
  // { type: 'fold'|'check'|'call'|'raise_to', amount_bb? }.
  submitHandAction: async (handId, action) => {
    const response = await api.post(`/poker/hands/${handId}/action/`, action);
    return response.data;
  },

  // Aggregated Arena session stats over the user's completed hands:
  // { hands_played, net_bb_total, bb_per_100, record, showdown, non_showdown,
  //   ev_loss_total_bb, ev_loss_per_hand_bb, ev_loss_by_street, preflop,
  //   by_profile, timeline }.
  getHandStats: async () => {
    const response = await api.get('/poker/hands/stats/');
    return response.data;
  },

  // DRF-paginated list of the user's completed hands, newest first, with the
  // EV ground truth captured at play time (for the Module 4 hand review).
  getHandHistory: async (page = 1) => {
    const url = page > 1 ? `/poker/hands/history/?page=${page}` : '/poker/hands/history/';
    const response = await api.get(url);
    return response.data;
  },
};

// Exploit Lab (Module 5): heads-up "diagnose the mystery opponent" matches.
// The bot's identity never appears in any response until the match completes —
// clients render only phase/counters/HUD until then, and the reveal on the
// completed-match GET. Hero actions reuse pokerService.submitHandAction.
export const exploitService = {
  // Start a match at 'easy' | 'medium' | 'hard'. Returns the leakage-safe match
  // state: { match_id, difficulty, phase, scout_target, exploit_target,
  //          scout_played, exploit_played, hud?, active_hand_id }.
  startMatch: async (difficulty = 'easy') => {
    const response = await api.post('/poker/exploit/matches/', { difficulty });
    return response.data;
  },

  // Current match state; includes `reveal` once phase === 'complete'.
  getMatch: async (id) => {
    const response = await api.get(`/poker/exploit/matches/${id}/`);
    return response.data;
  },

  // Deal (or resume) the next hand. Returns { hand_id, frame, phase,
  // hands_remaining }. 409s outside the scout/exploit phases.
  dealHand: async (id) => {
    const response = await api.post(`/poker/exploit/matches/${id}/hands/`);
    return response.data;
  },

  // Submit the diagnosis at the checkpoint. Returns { read_correct,
  // adjustment_correct, correct_read, correct_adjustment, phase, hud?, profile }.
  submitDiagnosis: async (id, read, adjustment) => {
    const response = await api.post(`/poker/exploit/matches/${id}/diagnosis/`, { read, adjustment });
    return response.data;
  },
};

export default api;
