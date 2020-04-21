import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { getTokenApi } from '../../experiment-tracking/actions';
import { connect } from 'react-redux';

class AuthComponentImpl extends Component {
    static propTypes = {
        dispatchGetTokenApi: PropTypes.func.isRequired,
        code: PropTypes.string,
      };

    componentDidMount = () => {
      const token = this.props.dispatchGetTokenApi(this.state.code);
      localStorage.setItem('token', token);
      console.log('got token');
      console.log(token);
    }

    render () {
        return (<div></div>);
    }
  
}

const mapStateToProps = (state, ownProps) => {
    const { match } = ownProps;
    const code = match.params.code;
    return {
        code: code
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
      dispatchGetTokenApi: (code) => {
        return dispatch(getTokenApi(code));
      },
    };
};

export const AuthComponent = connect(mapStateToProps, mapDispatchToProps)(AuthComponentImpl);
