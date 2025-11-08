package std

import (
	_ "embed"
	"os"
	"os/exec"

	"github.com/comoland/como/js"
)

func registerExec(ctx *js.Context) {
	mod := ctx.NewModule("std:exec")

	var exp = map[string]any{}

	// Command
	exp["command"] = func(args js.Arguments) interface{} {
		command := args.GetString(0)

		var cmdArgs []string
		err := args.GetMap(1, &cmdArgs)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		cmd := exec.Command(command, cmdArgs...)
		var methods = map[string]any{}

		methods["dir"] = cmd

		methods["env"] = func(args js.Arguments) any {
			var env []string
			err := args.GetMap(0, &env)
			if err != nil {
				return ctx.Throw(err.Error())
			}

			cmd.Env = env
			return methods
		}

		methods["stdout"] = func(args js.Arguments) any {
			cmd.Stdout = os.Stdin
			return methods
		}

		methods["run"] = func(args js.Arguments) any {
			return ctx.Async(func(async js.Promise) {
				err := cmd.Run()
				if err != nil {
					async.Reject(err.Error())
					return
				}

				async.Resolve(nil)
			})
		}

		methods["kill"] = func(args js.Arguments) interface{} {
			if cmd.Process != nil {
				err := cmd.Process.Kill()
				if err != nil {
					return ctx.Error(err.Error())
				}
			}
			return nil
		}

		methods["info"] = func(args js.Arguments) interface{} {
			return cmd
		}

		return methods
	}

	mod.Exports(exp)
	mod.Export("default", exp)
}
