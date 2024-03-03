package core

import (
	"encoding/json"
	"sync"

	"github.com/comoland/como/js"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func sql(ctx *js.Context, Como js.Value) {
	Como.Set("sql", func(args js.Arguments) interface{} {
		driver, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("sql arg(0) must be a string")
		}

		options, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("sql arg(1) must be a string")
		}

		db, err := sqlx.Open(driver, options)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		err = db.Ping()
		if err != nil {
			return ctx.Throw(err.Error())
		}

		db.SetMaxOpenConns(0)

		obj := ctx.Object()
		obj.Set("close", func(args js.Arguments) interface{} {
			db.Close()
			return nil
		})

		obj.Set("begin", func(args js.Arguments) interface{} {
			tx, _ := db.Beginx()

			transaction := ctx.Object()

			transaction.Set("commit", func(args js.Arguments) interface{} {
				err := tx.Commit()
				if err != nil {
					return ctx.Throw(err.Error())
				}

				return nil
			})

			transaction.Set("rollBack", func(args js.Arguments) interface{} {
				tx.Rollback()
				return nil
			})

			transaction.Set("query", func(args js.Arguments) interface{} {
				sqlStr, ok := args.Get(0).(string)
				if !ok {
					return ctx.Throw("query arg(0) must be a string")
				}

				bindArgs := args.Slice(1, -1)
				bindValues := make([]interface{}, bindArgs.Len())

				for i := 0; i < bindArgs.Len(); i++ {
					switch val := bindArgs.Get(i).(type) {
					case js.Value:
						if val.IsUndefined() {
							bindValues[i] = nil
						} else {
							return ctx.Throw("bind args must be a primative type")
						}
					default:
						bindValues[i] = val
					}
				}

				promise := ctx.NewPromise()
				arr := ctx.Array()
				var wg sync.WaitGroup

				go func() {
					rows, err := tx.Queryx(sqlStr, bindValues...)
					if err != nil {
						promise.Reject(ctx.Error(err.Error()))
					} else {
						for rows.Next() {
							record := make(map[string]interface{})
							rows.MapScan(record)
							jsonStr, err := json.Marshal(record)
							if err != nil {
								panic(err)
							}

							wg.Add(1)
							ctx.Channel <- func() {
								arr.Push(ctx.ParseJSON(string(jsonStr)))
								wg.Done()
							}

							wg.Wait()
						}

						promise.Resolve(func() interface{} {
							defer rows.Close()
							return arr
						})
					}
				}()

				return promise
			})

			exec := transaction.Set("exec", func(args js.Arguments) interface{} {
				stmt, ok := args.Get(0).(string)
				if !ok {
					return ctx.Throw("exec arg(0) must be a string")
				}

				bindArgs := args.Slice(1, -1)
				var bindValues = make([]interface{}, bindArgs.Len())
				for i := 0; i < bindArgs.Len(); i++ {
					switch val := bindArgs.Get(i).(type) {
					case js.Value:
						if val.IsUndefined() {
							bindValues[i] = nil
						} else {
							return ctx.Throw("bind args must be a primative type")
						}
					default:
						bindValues[i] = val
					}
				}

				promise := ctx.NewPromise()
				go func() {
					result, err := tx.Exec(stmt, bindValues...)
					if err != nil {
						promise.Reject(ctx.Error(err.Error()))
					} else {
						lastInserId, _ := result.LastInsertId()
						rowsAffected, _ := result.RowsAffected()
						promise.Resolve(func() interface{} {
							return map[string]interface{}{
								"lastInsertId": lastInserId,
								"rowsAffected": rowsAffected,
								"error":        nil,
							}
						})
					}
				}()
				return promise
			})

			exec.Set("sync", func(args js.Arguments) interface{} {
				stmt, ok := args.Get(0).(string)
				if !ok {
					return ctx.Throw("exec arg(0) must be a string")
				}

				bindArgs := args.Slice(1, -1)
				var bindValues = make([]interface{}, bindArgs.Len())
				for i := 0; i < bindArgs.Len(); i++ {
					switch val := bindArgs.Get(i).(type) {
					case js.Value:
						if val.IsUndefined() {
							bindValues[i] = nil
						} else {
							return ctx.Throw("bind args must be a primative type")
						}
					default:
						bindValues[i] = val
					}
				}

				result, err := db.Exec(stmt, bindValues...)
				if err != nil {
					return map[string]interface{}{
						"lastInsertId": 0,
						"rowsAffected": 0,
						"error":        err.Error(),
					}
				} else {
					lastInserId, _ := result.LastInsertId()
					rowsAffected, _ := result.RowsAffected()
					return map[string]interface{}{
						"lastInsertId": lastInserId,
						"rowsAffected": rowsAffected,
						"error":        nil,
					}
				}
			})

			return transaction
		})

		exec := obj.Set("exec", func(args js.Arguments) interface{} {
			stmt, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("exec arg(0) must be a string")
			}

			bindArgs := args.Slice(1, -1)
			var bindValues = make([]interface{}, bindArgs.Len())
			for i := 0; i < bindArgs.Len(); i++ {
				switch val := bindArgs.Get(i).(type) {
				case js.Value:
					if val.IsUndefined() {
						bindValues[i] = nil
					} else {
						return ctx.Throw("bind args must be a primative type")
					}
				default:
					bindValues[i] = val
				}
			}

			promise := ctx.NewPromise()
			go func() {
				result, err := db.Exec(stmt, bindValues...)
				if err != nil {
					promise.Reject(ctx.Error(err.Error()))
				} else {
					lastInserId, _ := result.LastInsertId()
					rowsAffected, _ := result.RowsAffected()
					promise.Resolve(func() interface{} {
						return map[string]interface{}{
							"lastInsertId": lastInserId,
							"rowsAffected": rowsAffected,
							"error":        nil,
						}
					})
				}
			}()
			return promise
		})

		exec.Set("sync", func(args js.Arguments) interface{} {
			stmt, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("exec arg(0) must be a string")
			}

			bindArgs := args.Slice(1, -1)
			var bindValues = make([]interface{}, bindArgs.Len())
			for i := 0; i < bindArgs.Len(); i++ {
				switch val := bindArgs.Get(i).(type) {
				case js.Value:
					if val.IsUndefined() {
						bindValues[i] = nil
					} else {
						return ctx.Throw("bind args must be a primative type")
					}
				default:
					bindValues[i] = val
				}
			}

			result, err := db.Exec(stmt, bindValues...)
			if err != nil {
				return map[string]interface{}{
					"lastInsertId": 0,
					"rowsAffected": 0,
					"error":        err.Error(),
				}
			} else {
				lastInserId, _ := result.LastInsertId()
				rowsAffected, _ := result.RowsAffected()
				return map[string]interface{}{
					"lastInsertId": lastInserId,
					"rowsAffected": rowsAffected,
					"error":        nil,
				}
			}
		})

		obj.Set("query", func(args js.Arguments) interface{} {
			sqlStr, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("query arg(0) must be a string")
			}

			bindArgs := args.Slice(1, -1)
			bindValues := make([]interface{}, bindArgs.Len())
			for i := 0; i < bindArgs.Len(); i++ {
				switch val := bindArgs.Get(i).(type) {
				case js.Value:
					if val.IsUndefined() {
						bindValues[i] = nil
					} else {
						return ctx.Throw("bind args must be a primative type")
					}
				default:
					bindValues[i] = val
				}
			}

			promise := ctx.NewPromise()
			go func() {
				rows, err := db.Queryx(sqlStr, bindValues...)
				if err != nil {
					promise.Reject(ctx.Error(err.Error()))
				} else {
					defer rows.Close()
					var records []interface{}
					for rows.Next() {
						record := map[string]interface{}{}
						rows.MapScan(record)
						records = append(records, record)
					}

					promise.Resolve(func() interface{} {
						return records
					})
				}
			}()
			return promise
		})

		obj.Set("query2", func(args js.Arguments) interface{} {
			sqlStr, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("query arg(0) must be a string")
			}

			bindArgs := args.Slice(1, -1)
			bindValues := make([]interface{}, bindArgs.Len())
			for i := 0; i < bindArgs.Len(); i++ {
				switch val := bindArgs.Get(i).(type) {
				case js.Value:
					if val.IsUndefined() {
						bindValues[i] = nil
					} else {
						return ctx.Throw("bind args must be a primative type")
					}
				default:
					bindValues[i] = val
				}
			}

			return map[string]interface{}{
				"stream": func(args js.Arguments) interface{} {
					writer := ctx.Writer(args.GetValue(0))
					if writer == nil {
						return ctx.Throw("query stream must has a writer callback")
					}

					return ctx.Async(func(async js.Promise) {
						rows, err := db.Queryx(sqlStr, bindValues...)
						defer writer.Close()
						if err != nil {
							async.Reject(ctx.Error(err.Error()))
						} else {
							defer rows.Close()
							for rows.Next() {
								record := map[string]interface{}{}
								rows.MapScan(record)
								writer.Call(record)
							}

							async.Resolve(func() interface{} {
								return nil
							})
						}
					})
				},
			}
		})

		return obj
	})
}
