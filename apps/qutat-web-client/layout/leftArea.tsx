// @ts-nocheck
import * as React from 'react';
import Link from 'next/link'
import style from './leftArea.module.css'

export class LeftArea extends React.Component {
  render() {
    
    return (
      <>
        <Link className={style.Link} href={"/setup/editor"}>Simulation</Link>
      </>
      );
  }

  constructor(props) {
    super(props);
    this.state = { };
  }

  componentDidMount() {

  }


}



