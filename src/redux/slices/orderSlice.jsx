import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Get Order Histories with pagination
export const getOrderHistories = createAsyncThunk(
  'order/getOrderHistories',
  async (params, { rejectWithValue }) => {
    try {
      const { page, limit, status, search, chatId, contactId } = params || {};
      const queryParams = {};

      if (page !== null && page !== undefined) {
        queryParams.page = String(page);
      }
      if (limit !== null && limit !== undefined) {
        queryParams.limit = String(limit);
      }
      if (status && status !== 'all') {
        queryParams.status = status;
      }
      if (search && search.trim()) {
        queryParams.search = search.trim();
      }
      if (chatId) {
        queryParams.chatId = chatId;
      }
      if (contactId) {
        queryParams.contactId = contactId;
      }

      const response = await callApi(endpoints.order.getOrderHistories, httpMethods.GET, queryParams);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch order histories');
      }

      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch order histories'
      );
    }
  }
);

const orderSlice = createSlice({
  name: 'order',
  initialState: {
    orderHistoryStatus: 'idle',
    orderHistories: [],
    totalOrderHistory: 0,
    error: null,
  },
  reducers: {
    clearOrderHistories: (state) => {
      state.orderHistories = [];
      state.totalOrderHistory = 0;
      state.orderHistoryStatus = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getOrderHistories.pending, (state) => {
        state.orderHistoryStatus = 'loading';
        state.error = null;
      })
      .addCase(getOrderHistories.fulfilled, (state, action) => {
        state.orderHistoryStatus = 'succeeded';
        state.orderHistories = action.payload.data?.data || action.payload._raw?.data || [];
        state.totalOrderHistory = action.payload.data?.totalResults || action.payload._raw?.totalResults || 0;
      })
      .addCase(getOrderHistories.rejected, (state, action) => {
        state.orderHistoryStatus = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearOrderHistories } = orderSlice.actions;
export default orderSlice.reducer;
