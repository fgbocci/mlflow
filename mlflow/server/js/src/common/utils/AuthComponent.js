import React, { Component } from 'react';
import { getTokenApi } from '../../experiment-tracking/actions';
import { connect } from 'react-redux';
import Utils from "../../common/utils/Utils";
import { Redirect } from 'react-router';

class AuthComponentImpl extends Component {

  constructor(props) {
    super(props);
    const urlState = Utils.getSearchParamsFromUrl(props.location.search);
    this.state = {
      persistedState: {
        code: urlState.code === undefined ? "" : urlState.code,
      },
    };
  }

  componentDidMount = () => {
    // const promise = getTokenApi(this.state.persistedState.code).payload
    // console.log(promise)
    // promise.then(response =>{
    //   console.log(response)
    //   console.log(response.headers.get('Access-Control-Expose-Headers'))
    //   console.log(response.headers.get(response.headers.get('Access-Control-Expose-Headers')))
    //   localStorage.setItem('token', response.headers.get(response.headers.get('Access-Control-Expose-Headers')))
    //   console.log('got token');
    //   console.log(localStorage.getItem('token'));
    // });
    const req = new XMLHttpRequest();
    req.open("GET", "/token?code=" + this.state.persistedState.code, false);
    req.send();
    if (req.status === 200) {
      const token = req.getResponseHeader(req.getResponseHeader('Access-Control-Expose-Headers'))
      localStorage.setItem('token', token)
    }
  }

  render () {
    return <Redirect to='/'/>;
  }
  
}

export const AuthComponent = connect(null, null)(AuthComponentImpl);
