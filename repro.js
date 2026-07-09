const {configureStore, createSlice} = require('@reduxjs/toolkit');
const _ = require('lodash');

console.log('immer version:', require('immer/package.json').version);

const slice = createSlice({
  name: 'demo',
  initialState: {
    settings: {
      options: {},
    },
  },
  reducers: {
    setOptions(state, action) {
      const currentOptions = state.settings.options;
      _.isEmpty(currentOptions); // throws on Immer 11.1.9+
      state.settings.options = action.payload;
    },
  },
});

const store = configureStore({reducer: {demo: slice.reducer}});

store.dispatch(slice.actions.setOptions({items: [{id: 1}]}));
console.log('OK ->', JSON.stringify(store.getState()));
