import './App.css';
import { useState } from 'react';

function App() {
  const [selected, setSelected] = useState('Home');
  const sections = [
    'Home',
    'About',
    'Contact',
    'Portfolio',
    'Blog',
    'Resume'
  ]
  
  return (
    <>
      <header>
        <div className='main-header'>
          <div className='avatar'></div>
          <div className='info'></div>
        </div>
        <span className='underline-header'></span>
      </header>
      <main>
        <div className='tabs-header'>
          {sections.map(section => 
          <div 
            className={`tab-header ${section}`} 
            style={{ color: section === selected ? 'black' : 'gray'}}
            onClick={() => setSelected(section)}
          >
            {section === selected ? section : `${section.slice(0,3)}...`}
          </div>
        )}
        </div>
        <div className={`content ${selected}`}></div>
        
      </main>
    </>
  );
}

export default App;
