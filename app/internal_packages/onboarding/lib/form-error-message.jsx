import fs from 'fs';
import temp from 'temp';
import { remote } from 'electron';
import { React, PropTypes, RegExpUtils } from 'mailspring-exports';

const FormErrorMessage = props => {
  const { message, log, empty } = props;
  if (!message) {
    return <div className="message empty">{empty}</div>;
  }

  let rawLogLink = false;
  if (log && log.length > 0) {
    const onViewLog = () => {
      const logPath = temp.path({ suffix: '.log' });
      fs.writeFileSync(logPath, log);
      remote.shell.openItem(logPath);
    };
    rawLogLink = (
      <a href="" onClick={onViewLog} style={{ paddingLeft: 5 }}>
        Details: {log}
      </a>
    );
  }

  if (typeof message === 'string') {
    const linkMatch = RegExpUtils.urlRegex({ matchEntireString: false }).exec(message);
    if (linkMatch) {
      const link = linkMatch[0];
      return (
        <div className="message error">
          {message.substr(0, linkMatch.index)}
          <a href={link}>{link}</a>
          {message.substr(linkMatch.index + link.length)}
          {rawLogLink}
        </div>
      );
    }
  }

  return (
    <div className="message error">
      {message}<br/>
      {rawLogLink}
    </div>
  );
};

FormErrorMessage.propTypes = {
  empty: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
};

export default FormErrorMessage;
