import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Async thunks
export const fetchAllTemplates = createAsyncThunk(
  'template/fetchAllTemplates',
  async ({ page = 0, limit = 10, sortBy = 'createdAt', search, all, type, status, health }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        ...(all && all !== 'undefined' && all !== ''
          ? { all: String(all) }
          : { page: String(page), limit: String(limit) }),
        sortBy,
      });

      if (search?.trim()) {
        queryParams.append('search', search);
      }
      if (type?.trim() && type !== '') {
        queryParams.append('type', type.toLowerCase());
      }
      if (health?.trim() && health !== '') {
        queryParams.append('health', health);
      }
      if (status?.trim() && status !== '') {
        queryParams.append('status', status);
      }

      const url = `${endpoints.template.fetchAllTemplates}/?${queryParams.toString()}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch templates');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTemplateById = createAsyncThunk(
  'template/fetchTemplateById',
  async ({ id, searchType = '' }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.template.fetchTemplateById}/${id}?searchType=${searchType}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch template');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTemplateStats = createAsyncThunk(
  'template/fetchTemplateStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.template.fetchTemplateStats, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch template stats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  templates: [],
  selectedTemplate: null,
  templatesStatus: 'idle',
  templateByIdStatus: 'idle',
  statsStatus: 'idle',
  templatesError: null,
  templateByIdError: null,
  statsError: null,
  approvedTemplates: 0,
  pendingTemplates: 0,
  draftTemplates: 0,
  rejectedTemplates: 0,
  totalTemplates: 0,
  totalSearchResult: 0,
};

// Slice
const templateSlice = createSlice({
  name: 'template',
  initialState,
  reducers: {
    setSelectedTemplate: (state, action) => {
      state.selectedTemplate = action.payload;
    },
    clearTemplateError: (state) => {
      state.templatesError = null;
      state.templateByIdError = null;
      state.statsError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch All Templates
    builder
      .addCase(fetchAllTemplates.pending, (state) => {
        state.templatesStatus = 'loading';
        state.templatesError = null;
      })
      .addCase(fetchAllTemplates.fulfilled, (state, action) => {
        state.templatesStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.templates = data.templates || [];
        state.totalSearchResult = data.totalResults || 0;
      })
      .addCase(fetchAllTemplates.rejected, (state, action) => {
        state.templatesStatus = 'failed';
        state.templatesError = action.payload;
      });

    // Fetch Template By ID
    builder
      .addCase(fetchTemplateById.pending, (state) => {
        state.templateByIdStatus = 'loading';
        state.templateByIdError = null;
      })
      .addCase(fetchTemplateById.fulfilled, (state, action) => {
        state.templateByIdStatus = 'succeeded';
        state.selectedTemplate = action.payload.data || action.payload;
      })
      .addCase(fetchTemplateById.rejected, (state, action) => {
        state.templateByIdStatus = 'failed';
        state.templateByIdError = action.payload;
      });

    // Fetch Template Stats
    builder
      .addCase(fetchTemplateStats.pending, (state) => {
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(fetchTemplateStats.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.totalTemplates = String(data.total || 0);
        state.pendingTemplates = String(data.pending || 0);
        state.approvedTemplates = String(data.approved || 0);
        state.draftTemplates = String(data.draft || 0);
        state.rejectedTemplates = String(data.rejected || 0);
      })
      .addCase(fetchTemplateStats.rejected, (state, action) => {
        state.statsStatus = 'failed';
        state.statsError = action.payload;
      });
  },
});

export const { setSelectedTemplate, clearTemplateError } = templateSlice.actions;
export default templateSlice.reducer;
