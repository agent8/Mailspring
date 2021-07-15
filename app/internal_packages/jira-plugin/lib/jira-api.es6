import JiraApiBase from 'jira-client';
const JIRA_CLIENT_ID = 'k5w4G817nXJRIEpss2GYizMxpTXbl7tn';
const JIRA_CLIENT_SECRET = 'cSTiX-4hpKKgwHSGdwgRSK5moMypv_v1-CIfTcWWJC8BkA2E0O0vK7CYhdglbIDE';

export default class JiraApi extends JiraApiBase {
  constructor(props) {
    super(props);
    if (props.refreshToken) {
      this.refreshToken = props.refreshToken;
    }
  }
  refreshAccessToken = async () => {
    const body = [];
    body.push(`refresh_token=${encodeURIComponent(this.refreshToken)}`);
    body.push(`client_id=${encodeURIComponent(JIRA_CLIENT_ID)}`);
    body.push(`client_secret=${encodeURIComponent(JIRA_CLIENT_SECRET)}`);
    body.push(`grant_type=${encodeURIComponent('refresh_token')}`);

    const resp = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      body: body.join('&'),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });
    const json = (await resp.json()) || {};
    if (!resp.ok) {
      throw new Error(
        `Jira OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
          json
        )}`
      );
    }
    const { access_token } = json;
    this.baseOptions.auth.bearer = access_token;
    AppEnv.config.set('plugin.jira.config.access_token', access_token);
  };
  async safeDoRequest(url) {
    if (AppEnv.inDevMode()) {
      console.log('****safeDoRequest', url);
    }
    let res = null;
    try {
      res = await this.doRequest(...arguments);
    } catch (err) {
      console.error('****safeDoProcess - 1', err);
      // if Oauth, refresh token
      if (this.baseOptions.auth.bearer && err.error.message === 'Unauthorized') {
        try {
          await this.refreshAccessToken();
        } catch (refreshError) {
          console.error('****safeDoProcess - 2', refreshError.message);
          throw refreshError;
        }
        res = await this.doRequest(...arguments);
      } else {
        throw err;
      }
    }
    return res;
  }
  findIssue(issueNumber, expand, fields, properties, fieldsByKeys) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueNumber),
          query: {
            expand: expand || '',
            fields: fields || '*all',
            properties: properties || '*all',
            fieldsByKeys: fieldsByKeys || false,
          },
        })
      )
    );
  }
  downloadThumbnail = attachment => {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/thumbnail/'
            .concat(attachment.id, '/')
            .concat(encodeURI(encodeURI(attachment.filename.replace(/ /g, '')))),
          intermediatePath: '/secure',
        }),
        {
          json: false,
          encoding: null,
        }
      )
    );
  };
  downloadAttachment = attachment => {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/attachment/'
            .concat(attachment.id, '/')
            .concat(encodeURI(encodeURI(attachment.filename.replace(/ /g, '')))),
          intermediatePath: '/secure',
        }),
        {
          json: false,
          encoding: null,
        }
      )
    );
  };
  findComments = (jiraId, expand, startAt, maxResults) => {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(jiraId).concat('/comment'),
          query: {
            expand: expand || 'renderedBody',
            startAt: startAt || 0,
            maxResults: maxResults || 50,
          },
        })
      )
    );
  };
  deleteComment = (jiraId, commentId) => {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'
            .concat(jiraId)
            .concat('/comment/')
            .concat(commentId),
        }),
        {
          method: 'DELETE',
          followAllRedirects: true,
        }
      )
    );
  };
  searchAssignableUsers(data) {
    var issueKey = data.issueKey,
      username = data.username,
      startAt = data.startAt,
      maxResults = data.maxResults,
      includeActive = data.includeActive,
      includeInactive = data.includeInactive;
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/user/assignable/search',
          query: {
            issueKey: issueKey,
            query: username,
            startAt: startAt || 0,
            maxResults: maxResults || 50,
            includeActive: includeActive || true,
            includeInactive: includeInactive || false,
          },
        }),
        {
          followAllRedirects: true,
        }
      )
    );
  }
  searchUsers(query, maxResults) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/user/search',
          query: {
            query,
            maxResults: maxResults || 20,
          },
        }),
        {
          followAllRedirects: true,
        }
      )
    );
  }
  updateAssignee(issueKey, accountId) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueKey, '/assignee'),
        }),
        {
          method: 'PUT',
          followAllRedirects: true,
          body: {
            accountId,
          },
        }
      )
    );
  }
  transitionIssue(issueId, issueTransition) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/transitions'),
        }),
        {
          body: issueTransition,
          method: 'POST',
          followAllRedirects: true,
        }
      )
    );
  }
  listTransitions(issueId) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/transitions'),
          query: {
            expand: 'transitions.fields',
          },
        })
      )
    );
  }
  addComment(issueId, comment) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/comment'),
        }),
        {
          body: {
            body: comment,
          },
          method: 'POST',
          followAllRedirects: true,
        }
      )
    );
  }
  getIssueWatchers(issueNumber) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueNumber, '/watchers'),
        })
      )
    );
  }
  addWatcher(issueKey, username) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueKey, '/watchers'),
        }),
        {
          method: 'POST',
          followAllRedirects: true,
          body: username,
        }
      )
    );
  }
  deleteWatcher(issueKey, accountId) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueKey, '/watchers'),
          query: {
            accountId,
          },
        }),
        {
          method: 'DELETE',
          followAllRedirects: true,
        }
      )
    );
  }
  listPriorities() {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/priority',
        })
      )
    );
  }
  listVersions(project) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/project/'.concat(project).concat('/versions'),
        })
      )
    );
  }
  listLabels(content) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/jql/autocompletedata/suggestions',
          query: {
            fieldName: 'labels',
            fieldValue: content,
          },
        })
      )
    );
  }
  setIssuePriority(issueNumber, priority) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueNumber),
        }),
        {
          method: 'PUT',
          followAllRedirects: true,
          body: {
            fields: {
              priority,
            },
          },
        }
      )
    );
  }
  setIssueFixVersions(issueNumber, fixVersions) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueNumber),
        }),
        {
          method: 'PUT',
          followAllRedirects: true,
          body: {
            fields: {
              fixVersions,
            },
          },
        }
      )
    );
  }
  setIssueLabels(issueNumber, labels) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueNumber),
        }),
        {
          method: 'PUT',
          followAllRedirects: true,
          body: {
            fields: {
              labels,
            },
          },
        }
      )
    );
  }
  updateComment(issueId, commentId, comment) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/comment/').concat(commentId),
        }),
        {
          body: {
            body: comment,
          },
          method: 'PUT',
          followAllRedirects: true,
        }
      )
    );
  }
  updateDescription(issueId, description) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId),
        }),
        {
          body: {
            update: {
              description: [{ set: description }],
            },
          },
          method: 'PUT',
          followAllRedirects: true,
        }
      )
    );
  }
  myPermissions(permissions) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/mypermissions',
          query: {
            permissions: permissions.join(','),
          },
        })
      )
    );
  }
  getCurrentUser(expand) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/myself',
          query: {
            expand: expand || ['groups', 'applicationRoles'].join(','),
          },
        })
      )
    );
  }
}
