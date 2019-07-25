import React, { Component } from 'react';
import './ExperimentPage.css';
import PropTypes from 'prop-types';
import { getExperimentApi, getUUID, searchRunsApi } from '../Actions';
import { connect } from 'react-redux';
import ExperimentView from './ExperimentView';
import RequestStateWrapper from './RequestStateWrapper';
import KeyFilter from '../utils/KeyFilter';
import { ViewType } from '../sdk/MlflowEnums';
import { ExperimentPagePersistedState } from "../sdk/MlflowLocalStorageMessages";
import Utils from "../utils/Utils";
import ErrorCodes from "../sdk/ErrorCodes";
import PermissionDeniedView from "./PermissionDeniedView";
import {Spinner} from "./Spinner";
import { withRouter } from 'react-router-dom';

export const LIFECYCLE_FILTER = { ACTIVE: 'Active', DELETED: 'Deleted' };

export class ExperimentPage extends Component {
  constructor(props) {
    super(props);
    this.onSearch = this.onSearch.bind(this);
    this.getRequestIds = this.getRequestIds.bind(this);
    const urlState = Utils.getSearchParamsFromUrl(props.location.search);
    this.state = {
      ...ExperimentPage.getDefaultUnpersistedState(),
      persistedState: {
        paramKeyFilterString: urlState.params === undefined ? "" : urlState.params,
        metricKeyFilterString: urlState.metrics === undefined ? "" : urlState.metrics,
        searchInput: urlState.search === undefined ? "" : urlState.search,
        orderByKey: urlState.orderByKey === undefined ? null : urlState.orderByKey,
        orderByAsc: urlState.orderByAsc === undefined ? true : urlState.orderByAsc === "true",
      },
    };
  }

  static propTypes = {
    experimentId: PropTypes.number.isRequired,
    getExperimentApi: PropTypes.func.isRequired,
    searchRunsApi: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    location: PropTypes.object,
  };

  /** Returns default values for state attributes that aren't persisted in the URL. */
  static getDefaultUnpersistedState() {
    return {
      // String UUID associated with a GetExperiment API request
      getExperimentRequestId: getUUID(),
      // String UUID associated with a SearchRuns API request
      searchRunsRequestId: getUUID(),
      // Last experiment, if any, displayed by this instance of ExperimentPage
      lastExperimentId: undefined,
      // Lifecycle filter of runs to display
      lifecycleFilter: LIFECYCLE_FILTER.ACTIVE,
    };
  }

  snapshotComponentState() {

  }

  componentDidUpdate() {
    this.snapshotComponentState();
  }

  componentWillUnmount() {
    // Snapshot component state on unmounts to ensure we've captured component state in cases where
    // componentDidUpdate doesn't fire.
    this.snapshotComponentState();
  }

  static getDerivedStateFromProps(props, state) {
    if (props.experimentId !== state.lastExperimentId) {
      const newState = {
        ...ExperimentPage.getDefaultUnpersistedState(),
        persistedState: state.lastExperimentId === undefined ?
            state.persistedState : (new ExperimentPagePersistedState()).toJSON(),
        lastExperimentId: props.experimentId,
        lifecycleFilter: LIFECYCLE_FILTER.ACTIVE,
      };
      props.getExperimentApi(props.experimentId, newState.getExperimentRequestId);
      const orderBy = ExperimentPage.getOrderByExpr(newState.persistedState.orderByKey,
        newState.persistedState.orderByAsc);
      props.searchRunsApi(
        [props.experimentId],
        newState.persistedState.searchInput,
        lifecycleFilterToRunViewType(newState.lifecycleFilter),
        orderBy,
        newState.searchRunsRequestId);
      return newState;
    }
    return null;
  }

  onSearch(
      paramKeyFilterString,
      metricKeyFilterString,
      searchInput,
      lifecycleFilterInput,
      orderByKey,
      orderByAsc) {
    this.setState({
      persistedState: new ExperimentPagePersistedState({
        paramKeyFilterString,
        metricKeyFilterString,
        searchInput,
        orderByKey,
        orderByAsc,
      }).toJSON(),
      lifecycleFilter: lifecycleFilterInput,
    });

    const orderBy = ExperimentPage.getOrderByExpr(orderByKey, orderByAsc);
    const searchRunsRequestId = getUUID();
    this.props.searchRunsApi([this.props.experimentId], searchInput,
      lifecycleFilterToRunViewType(lifecycleFilterInput), orderBy, searchRunsRequestId);
    this.setState({ searchRunsRequestId });
    this.updateUrlWithSearchFilter({
      paramKeyFilterString,
      metricKeyFilterString,
      searchInput,
      orderByKey,
      orderByAsc,
    });
  }

  static getOrderByExpr(orderByKey, orderByAsc) {
    let orderBy = [];
    if (orderByKey) {
      if (orderByAsc) {
        orderBy = [orderByKey + " ASC"];
      } else {
        orderBy = [orderByKey + " DESC"];
      }
    }
    return orderBy;
  }

  updateUrlWithSearchFilter(
      {paramKeyFilterString, metricKeyFilterString, searchInput, orderByKey, orderByAsc}) {
    const state = {};
    if (paramKeyFilterString) {
      state['params'] = paramKeyFilterString;
    }
    if (metricKeyFilterString) {
      state['metrics'] = metricKeyFilterString;
    }
    if (searchInput) {
      state['search'] = searchInput;
    }
    if (orderByKey) {
      state['orderByKey'] = orderByKey;
    }
    // orderByAsc defaults to true, so only encode it if it is false.
    if (orderByAsc === false) {
      state['orderByAsc'] = orderByAsc;
    }
    const newUrl = `/experiments/${this.props.experimentId}` +
      `/s?${Utils.getSearchUrlFromState(state)}`;
    if (newUrl !== (this.props.history.location.pathname
      + this.props.history.location.search)) {
      this.props.history.push(newUrl);
    }
  }

  renderExperimentView = (isLoading, shouldRenderError, requests) => {
    let searchRunsError;
    const getExperimentRequest = Utils.getRequestWithId(
      requests, this.getExperimentRequestId);

    if (shouldRenderError) {
      const searchRunsRequest = Utils.getRequestWithId(
        requests, this.searchRunsRequestId);
      if (getExperimentRequest.error.getErrorCode() === ErrorCodes.PERMISSION_DENIED) {
        return (<PermissionDeniedView
          errorMessage={getExperimentRequest.error.getMessageField()}
        />);
      } else if (searchRunsRequest.error) {
        searchRunsError = searchRunsRequest.error.getMessageField();
      } else {
        return undefined;
      }
    }
    if (!getExperimentRequest || getExperimentRequest.active) {
      return <Spinner/>;
    }

    return <ExperimentView
      paramKeyFilter={new KeyFilter(this.state.persistedState.paramKeyFilterString)}
      metricKeyFilter={new KeyFilter(this.state.persistedState.metricKeyFilterString)}
      experimentId={this.props.experimentId}
      searchRunsRequestId={this.searchRunsRequestId}
      lifecycleFilter={this.state.lifecycleFilter}
      onSearch={this.onSearch}
      searchRunsError={searchRunsError}
      searchInput={this.state.persistedState.searchInput}
      isLoading={isLoading && !searchRunsError}
      orderByKey={this.state.persistedState.orderByKey}
      orderByAsc={this.state.persistedState.orderByAsc}
      nextPageToken={this.state.nextPageToken}
      handleLoadMoreRuns={this.handleLoadMoreRuns}
      loadingMore={this.state.loadingMore}
    />;
  }

  render() {
    return (
      <div className="ExperimentPage runs-table-flex-container" style={{height: "100%"}}>
        <RequestStateWrapper shouldOptimisticallyRender requestIds={this.getRequestIds()}>
          {(isLoading, shouldRenderError, requests) => {
            let searchRunsError;
            const getExperimentRequest = Utils.getRequestWithId(
              requests, this.state.getExperimentRequestId);
            if (shouldRenderError) {
              const searchRunsRequest = Utils.getRequestWithId(
                requests, this.state.searchRunsRequestId);
              if (searchRunsRequest.error) {
                searchRunsError = searchRunsRequest.error.getMessageField();
              } else if (getExperimentRequest.error.getErrorCode() ===
                  ErrorCodes.PERMISSION_DENIED) {
                return (<PermissionDeniedView
                  errorMessage={getExperimentRequest.error.xhr.responseJSON.message}
                />);
              } else {
                return undefined;
              }
            }
            if (getExperimentRequest.active) {
              return <Spinner/>;
            }

            return <ExperimentView
              paramKeyFilter={new KeyFilter(this.state.persistedState.paramKeyFilterString)}
              metricKeyFilter={new KeyFilter(this.state.persistedState.metricKeyFilterString)}
              experimentId={this.props.experimentId}
              searchRunsRequestId={this.state.searchRunsRequestId}
              lifecycleFilter={this.state.lifecycleFilter}
              onSearch={this.onSearch}
              searchRunsError={searchRunsError}
              searchInput={this.state.persistedState.searchInput}
              isLoading={isLoading && !searchRunsError}
              orderByKey={this.state.persistedState.orderByKey}
              orderByAsc={this.state.persistedState.orderByAsc}
            />;
          }}
        </RequestStateWrapper>
      </div>
    );
  }

  getRequestIds() {
    return [this.state.getExperimentRequestId, this.state.searchRunsRequestId];
  }
}

const mapDispatchToProps = {
  getExperimentApi,
  searchRunsApi,
};

const lifecycleFilterToRunViewType = (lifecycleFilter) => {
  if (lifecycleFilter === LIFECYCLE_FILTER.ACTIVE) {
    return ViewType.ACTIVE_ONLY;
  } else {
    return ViewType.DELETED_ONLY;
  }
};

export default withRouter(connect(undefined, mapDispatchToProps)(ExperimentPage));
