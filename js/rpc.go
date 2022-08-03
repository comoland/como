package js

type RPC struct {
	ctx      *Context
	in       chan interface{}
	fn       *Function
	args     interface{}
	closed   bool
	Send     func(args interface{}) interface{}
	SendOnce func(args interface{}) interface{}
	Close    func()
}

func (ctx *Context) NewRPC(fn *Function) *RPC {
	fn.Dup()
	in := make(chan interface{})
	c := &RPC{
		ctx:    ctx,
		fn:     fn,
		in:     in,
		closed: false,
	}

	ctx.Ref()
	c.Send = func(args interface{}) interface{} {
		c.args = args
		ctx.Channel <- c

		var ret interface{}
		for {
			pending := <-in
			ret = pending
			break
		}

		return ret
	}

	c.Close = func() {
		if c.closed == false {
			c.closed = true
			go func() {
				ctx.Channel <- func() {
					defer fn.Free()
					defer ctx.UnRef()
				}
			}()
		}
	}

	c.SendOnce = func(args interface{}) interface{} {
		ret := c.Send(args)
		defer c.Close()
		return ret
	}

	return c
}
