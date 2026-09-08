import sqlTrusted from 'mssql/msnodesqlv8.js';

const baseTransactionPrototype = Object.getPrototypeOf(sqlTrusted.Transaction.prototype);

// mssql's native entry point ships without declarations. Describe the inherited
// API used by this wrapper; runtime behavior remains the installed driver.
/** @typedef {import('node:events').EventEmitter & {
 * parent: { release: (connection: object) => void },
 * commit: (callback?: (error?: Error) => void) => Promise<void>,
 * rollback: (callback?: (error?: Error) => void) => Promise<void>,
 * _rollbackRequested?: boolean
 * }} TrustedTransactionInstance */
/** @type {new (parent: object, config?: object) => TrustedTransactionInstance} */
const TrustedTransaction = sqlTrusted.Transaction;

function transactionError(error) {
  return error instanceof sqlTrusted.TransactionError
    ? error
    : new sqlTrusted.TransactionError(error);
}

export class SafeTrustedTransaction extends TrustedTransaction {
  executeBoundaryStatement(statement, callback) {
    const request = new sqlTrusted.Request(this);
    request.stream = false;
    request.query(statement, callback);
  }

  finishBoundary(statement, callback) {
    const finish = (statementFailure = null) => {
      let failure = statementFailure ? transactionError(statementFailure) : null;
      const connection = this._acquiredConnection;
      if (failure && connection && typeof connection === 'object') {
        connection.hasError = true;
      }
      try {
        this.parent.release(connection);
      } catch (releaseFailure) {
        failure ||= transactionError(releaseFailure);
      }
      if (failure) {
        failure.transactionOutcome = 'unverified';
        if (connection && typeof connection === 'object') connection.hasError = true;
      }
      this._boundaryFailure = failure;
      this._acquiredConnection = null;
      this._acquiredConfig = null;
      callback(failure);
    };

    try {
      this.executeBoundaryStatement(statement, finish);
    } catch (error) {
      finish(error);
    }
  }

  _commit(callback) {
    baseTransactionPrototype._commit.call(this, (error) => {
      if (error) return callback(error);
      this.finishBoundary('commit tran', callback);
    });
  }

  _rollback(callback) {
    if (!this._acquiredConnection && this._boundaryFailure) {
      return setImmediate(callback, this._boundaryFailure);
    }
    baseTransactionPrototype._rollback.call(this, (error) => {
      if (error) return callback(error);
      this.finishBoundary('rollback tran', callback);
    });
  }
}

export class SafeTrustedConnectionPool extends sqlTrusted.ConnectionPool {
  request(config) {
    return new sqlTrusted.Request(this, config);
  }

  transaction(config) {
    return new SafeTrustedTransaction(this, config);
  }
}

export const safeTrustedSqlDriver = Object.assign(Object.create(sqlTrusted), {
  ConnectionPool: SafeTrustedConnectionPool,
  Transaction: SafeTrustedTransaction,
});
